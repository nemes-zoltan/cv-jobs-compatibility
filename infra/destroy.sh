#!/usr/bin/env bash
#
# Tears the whole stack down.
#
# This matters more than usual: the stack has no reason to exist between demos
# and bills for every hour it does. Everything carries a Project=cv-jobs tag, so
# the last step can check what is left rather than assume nothing is.
#
# Usage:  infra/destroy.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly TF_DIR="${REPO_ROOT}/infra/terraform"
readonly PROJECT="cv-jobs"

step() { printf '\n\033[1;34m==>\033[0m \033[1m%s\033[0m\n' "$1"; }
warn() { printf '\n\033[1;33mWarning:\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

REGION="$(aws configure get region || echo "${AWS_REGION:-eu-central-1}")"
readonly REGION

if [[ ! -f "${TF_DIR}/terraform.tfstate" ]]; then
  echo "No local state at ${TF_DIR}/terraform.tfstate - nothing for Terraform to destroy."
  exit 0
fi

step "Destroying the stack"

# image_tag is required but irrelevant to a destroy; its validation rule just
# has to pass.
destroy() {
  terraform -chdir="${TF_DIR}" destroy -input=false -auto-approve -var "image_tag=destroy" "$@"
}

# The fallback is the important part.
#
# Terraform refreshes every resource before it will plan a destroy, and a
# refresh needs *read* permission on things the teardown itself does not need -
# reading tags back off an autoscaling target, for one. A single missing read
# aborts the whole destroy before one resource is deleted, which is the worst
# moment to be stuck: everything is still running and still billing.
#
# -refresh=false plans from stored state instead of asking AWS what is there.
# That is normally a bad idea, and is exactly right when the intent is "delete
# all of it" - the plan is the same either way, and anything already gone comes
# back as a harmless not-found.
if ! destroy; then
  warn "Destroy failed. Retrying from stored state, without refreshing.
         This is usually a missing read permission rather than a real problem."

  if ! destroy -refresh=false; then
    fail "Destroy failed twice. Resources are still running and still billing.
       Kill the expensive things by hand, then re-run this script:

         aws ecs update-service --cluster ${PROJECT}-serving --service ${PROJECT}-api    --desired-count 0
         aws ecs update-service --cluster ${PROJECT}-serving --service ${PROJECT}-web    --desired-count 0
         aws ecs update-service --cluster ${PROJECT}-workers --service ${PROJECT}-worker --desired-count 0
         aws rds delete-db-instance --db-instance-identifier ${PROJECT} --skip-final-snapshot --delete-automated-backups
         aws ec2 describe-nat-gateways --filter Name=state,Values=available --query 'NatGateways[].NatGatewayId' --output text
         aws ec2 delete-nat-gateway --nat-gateway-id <id-from-above>"
  fi
fi

# Terraform never created this one - deploy.sh did, precisely so the key would
# stay out of state - so Terraform will not remove it either.
step "Deleting the Gemini API key parameter"

if aws ssm delete-parameter --name "/${PROJECT}/gemini-api-key" --region "${REGION}" 2>/dev/null; then
  echo "Deleted."
else
  echo "Already gone."
fi

step "Checking for anything left behind"

LEFTOVERS="$(aws resourcegroupstaggingapi get-resources \
  --region "${REGION}" \
  --tag-filters "Key=Project,Values=${PROJECT}" \
  --query 'ResourceTagMappingList[].ResourceARN' --output text 2>/dev/null || echo "UNCHECKED")"

if [[ "${LEFTOVERS}" == "UNCHECKED" ]]; then
  echo "Could not check - the Resource Groups Tagging API is not permitted for this user."
  echo "Confirm by hand: ECS, RDS, EC2 (load balancers, NAT gateways, elastic IPs), S3, ECR."
elif [[ -z "${LEFTOVERS}" ]]; then
  echo "Nothing tagged Project=${PROJECT} remains in ${REGION}."
else
  printf '\033[1;33mStill present:\033[0m\n%s\n' "${LEFTOVERS}"
fi
