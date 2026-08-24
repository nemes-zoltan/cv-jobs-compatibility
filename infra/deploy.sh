#!/usr/bin/env bash
#
# Builds both images, applies the stack, migrates, brings the services up.
#
# There are three applies rather than one, and the ordering is the point.
# Nothing migrates on boot - several instances racing to alter one schema on
# every scaling event is the problem being avoided - so the schema has to exist
# before anything that reads it starts, and a failed migration has to stop the
# deployment rather than be stepped over.
#
# Both the API and the worker need the schema at boot, not just at first
# request: QueueModule.onModuleInit calls boss.start(), which throws when the
# pgboss schema is missing. So neither can be running when the migration runs.
#
#   1. ECR only                 services cannot start without an image to pull
#   2. build and push
#   3. everything, all services held at zero tasks
#   4. run the migration, stop here if it fails
#   5. the same apply again, with the real task counts
#
# Step 3 uses desired_count=0 rather than -target. Targeting looked tidier and
# was wrong: a task definition references the execution role's ARN but not the
# role's policies, and references no subnets at all, so -target quietly built a
# migration task that could neither pull its image nor reach a network.
#
# Usage:  infra/deploy.sh [image-tag]
#
# The tag defaults to the current commit. Passing an older one is a rollback.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly TF_DIR="${REPO_ROOT}/infra/terraform"
readonly PROJECT="cv-jobs"

cd "${REPO_ROOT}"

step() { printf '\n\033[1;34m==>\033[0m \033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

# --- Preconditions ---------------------------------------------------------

for tool in aws terraform docker git; do
  command -v "${tool}" >/dev/null || fail "${tool} is not installed."
done

aws sts get-caller-identity >/dev/null 2>&1 || fail "AWS credentials are not working."

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGION="$(aws configure get region || echo "${AWS_REGION:-eu-central-1}")"
readonly ACCOUNT_ID REGION
readonly REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

IMAGE_TAG="${1:-$(git rev-parse --short HEAD)}"
readonly IMAGE_TAG

if [[ -z "${1:-}" ]] && ! git diff --quiet HEAD 2>/dev/null; then
  printf '\033[1;33mWarning:\033[0m working tree is dirty, so tag %s does not describe what is being built.\n' "${IMAGE_TAG}"
fi

# The one secret Terraform must never see: it is yours, it outlives the stack,
# and an apply that took it as a variable would write it to state in plaintext.
GEMINI_API_KEY="${GOOGLE_GEMINI_API_KEY:-}"
if [[ -z "${GEMINI_API_KEY}" && -f apps/api/.env ]]; then
  GEMINI_API_KEY="$(grep -E '^GOOGLE_GEMINI_API_KEY=' apps/api/.env | head -1 | cut -d= -f2- || true)"
  # dotenv strips surrounding quotes and a naive cut does not, so a key written
  # as KEY="abc" would otherwise reach SSM with the quotes attached and fail
  # every Gemini call for a reason nothing in the logs would explain.
  GEMINI_API_KEY="${GEMINI_API_KEY%$'\r'}"
  GEMINI_API_KEY="${GEMINI_API_KEY#[\"\']}"
  GEMINI_API_KEY="${GEMINI_API_KEY%[\"\']}"
fi
readonly GEMINI_API_KEY

if [[ -z "${GEMINI_API_KEY}" || "${GEMINI_API_KEY}" == "your-key-here" ]]; then
  fail "No Gemini API key. Set GOOGLE_GEMINI_API_KEY or put a real one in apps/api/.env.
       Without it the worker starts and then fails every extraction."
fi

step "Deploying ${PROJECT} to ${REGION} (account ${ACCOUNT_ID}) at tag ${IMAGE_TAG}"

# --- 1. Repositories -------------------------------------------------------

step "Creating the ECR repositories"

terraform -chdir="${TF_DIR}" init -input=false >/dev/null

terraform -chdir="${TF_DIR}" apply -input=false -auto-approve \
  -var "image_tag=${IMAGE_TAG}" \
  -target=aws_ecr_repository.api \
  -target=aws_ecr_repository.web

readonly API_REPO="${REGISTRY}/${PROJECT}-api"
readonly WEB_REPO="${REGISTRY}/${PROJECT}-web"

# --- 2. Images -------------------------------------------------------------

step "Building and pushing images"

aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${REGISTRY}" >/dev/null

# An image tag is a git SHA, so a tag already in ECR was built from exactly this
# commit and there is nothing to rebuild. Re-running the script after a failure
# in a later step therefore costs seconds rather than the five minutes a full
# `pnpm install` takes.
#
# The hole in that reasoning is a dirty tree, where the tag no longer describes
# what is on disk. Hence FORCE_BUILD=1, and the warning below.
image_in_ecr() {
  aws ecr describe-images \
    --repository-name "$1" \
    --image-ids "imageTag=${IMAGE_TAG}" \
    --region "${REGION}" >/dev/null 2>&1
}

# --platform is explicit because the task definitions ask for the X86_64 runtime
# platform, and a silently arm64 image fails at task start with an exec format
# error rather than at build time.
#
# Both build from the repository root: each app depends on workspace packages
# outside its own directory.
build_and_push() {
  local repo_name="$1" dockerfile="$2" image="$3"

  if [[ "${FORCE_BUILD:-0}" != "1" ]] && image_in_ecr "${repo_name}"; then
    echo "  ${repo_name}:${IMAGE_TAG} is already in ECR - skipping. FORCE_BUILD=1 to rebuild."
    return
  fi

  docker build --platform linux/amd64 -f "${dockerfile}" -t "${image}:${IMAGE_TAG}" .
  docker push "${image}:${IMAGE_TAG}"
}

if [[ "${FORCE_BUILD:-0}" != "1" ]] && ! git diff --quiet HEAD 2>/dev/null; then
  printf '\033[1;33mNote:\033[0m tree is dirty. A tag already in ECR will be reused and will not\n'
  printf '      contain your uncommitted changes. Re-run with FORCE_BUILD=1 to rebuild.\n'
fi

build_and_push "${PROJECT}-api" apps/api/Dockerfile "${API_REPO}"
build_and_push "${PROJECT}-web" apps/web/Dockerfile "${WEB_REPO}"

# --- 3. The secret Terraform does not own ----------------------------------

step "Storing the Gemini API key in SSM"

aws ssm put-parameter \
  --name "/${PROJECT}/gemini-api-key" \
  --description "Read by the worker only. Not managed by Terraform - see ssm.tf." \
  --type SecureString \
  --value "${GEMINI_API_KEY}" \
  --overwrite \
  --region "${REGION}" >/dev/null

# --- 4. Database and migration task, but nothing serving -------------------

step "Creating the infrastructure, with nothing running yet"

# The whole configuration - network, NAT, RDS, load balancer, clusters, task
# definitions, services - but every service held at zero tasks. Nothing is
# serving traffic and nothing has opened a connection to the database, so the
# schema can change underneath it safely.
#
# On a first run this is where most of the time goes: RDS and the NAT gateway
# are both slow.
terraform -chdir="${TF_DIR}" apply -input=false -auto-approve \
  -var "image_tag=${IMAGE_TAG}" \
  -var "api_desired_count=0" \
  -var "web_desired_count=0" \
  -var "worker_desired_count=0"

# A full apply, so the outputs are all resolvable.
CLUSTER="$(terraform -chdir="${TF_DIR}" output -raw workers_cluster)"
# The JSON is pretty-printed across several lines, so newlines have to go too -
# a stray one produces an awsvpcConfiguration the CLI rejects.
SUBNETS="$(terraform -chdir="${TF_DIR}" output -json app_subnet_ids | tr -d '[]" \n\r\t')"
SECURITY_GROUP="$(terraform -chdir="${TF_DIR}" output -raw task_security_group_id)"
readonly CLUSTER SUBNETS SECURITY_GROUP

[[ -n "${SUBNETS}" ]] || fail "Could not read the app-tier subnets from Terraform outputs."

# --- 5. Migrate ------------------------------------------------------------

step "Applying migrations"

# No public IP: the app tier reaches ECR through the NAT gateway.
TASK_ARN="$(aws ecs run-task \
  --region "${REGION}" \
  --cluster "${CLUSTER}" \
  --task-definition "${PROJECT}-migrate" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)"
readonly TASK_ARN

[[ "${TASK_ARN}" != "None" && -n "${TASK_ARN}" ]] || fail "The migration task did not start."

echo "Waiting for ${TASK_ARN##*/}"
aws ecs wait tasks-stopped --region "${REGION}" --cluster "${CLUSTER}" --tasks "${TASK_ARN}"

EXIT_CODE="$(aws ecs describe-tasks --region "${REGION}" --cluster "${CLUSTER}" --tasks "${TASK_ARN}" \
  --query 'tasks[0].containers[0].exitCode' --output text)"
readonly EXIT_CODE

if [[ "${EXIT_CODE}" != "0" ]]; then
  STOPPED_REASON="$(aws ecs describe-tasks --region "${REGION}" --cluster "${CLUSTER}" --tasks "${TASK_ARN}" \
    --query 'tasks[0].stoppedReason' --output text)"
  printf '\n--- migration logs ---\n'
  aws logs tail "/ecs/${PROJECT}/migrate" --region "${REGION}" --since 20m 2>/dev/null || true
  # Fatal on purpose. Bringing the services up now would run new code against a
  # schema that does not support it.
  fail "Migration exited ${EXIT_CODE} (${STOPPED_REASON}). No services were started."
fi

echo "Migrations applied."

# --- 6. Everything else ----------------------------------------------------

step "Starting the services"

# The same configuration again, now with the real task counts. This is the apply
# that creates the autoscaling targets too - they are skipped while a service
# sits at zero.
terraform -chdir="${TF_DIR}" apply -input=false -auto-approve -var "image_tag=${IMAGE_TAG}"

step "Waiting for the services to stabilise"

# The circuit breaker on each service means a genuinely broken image rolls back
# rather than hanging until this times out.
aws ecs wait services-stable --region "${REGION}" \
  --cluster "${PROJECT}-serving" --services "${PROJECT}-api" "${PROJECT}-web"

aws ecs wait services-stable --region "${REGION}" \
  --cluster "${PROJECT}-workers" --services "${PROJECT}-worker"

APP_URL="$(terraform -chdir="${TF_DIR}" output -raw app_url)"
readonly APP_URL

step "Done"

cat <<EOF

  App        ${APP_URL}
  Health     ${APP_URL}/api/health
  Traces     https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#xray:service-map
  Logs       aws logs tail /ecs/${PROJECT}/api --follow
             aws logs tail /ecs/${PROJECT}/worker --follow

  Roughly \$0.29/hour while this is up. Tear it down with infra/destroy.sh.

EOF
