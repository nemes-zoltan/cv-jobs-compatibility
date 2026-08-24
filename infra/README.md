# Infrastructure

Terraform and deploy scripts for running the API, the web app and the queue
worker on AWS ECS Fargate.

Architecture and the trade-offs behind it are in
[DEPLOYMENT.md](../DEPLOYMENT.md) and [ARCHITECTURE.md](../ARCHITECTURE.md).

## Prerequisites

| | Version | Notes |
| --- | --- | --- |
| AWS CLI | v2 | Configured with credentials and a region |
| Terraform | 1.10+ | 1.10 is the floor - the commented S3 backend uses `use_lockfile` |
| Docker | any recent | Daemon must be running; builds two images |
| git | any | The image tag is the current commit SHA |

## AWS credentials

Either `aws configure`, or environment variables:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=eu-central-1
```

Verify before deploying:

```bash
aws sts get-caller-identity
aws configure get region        # must not be empty
```

The region defaults to `eu-central-1` in Terraform. To deploy elsewhere, set
both `AWS_REGION` and the `aws_region` variable.

## IAM permissions

The deploying identity needs write access to:

`ec2` (VPC, subnets, NAT, security groups) · `elasticloadbalancing` · `ecs` ·
`ecr` · `rds` · `s3` · `ssm` · `iam` · `logs` · `application-autoscaling` ·
`xray`

Two worth calling out:

- **`application-autoscaling:*`** is easy to miss and fails late, after the
  services are already running. `RegisterScalableTarget` needs `TagResource`,
  and the provider then needs `ListTagsForResource` to read the tags back.
- **Secrets Manager is not used.** Secrets live in SSM Parameter Store, so no
  `secretsmanager` permission is required.

If autoscaling fails with `AccessDeniedException`:

```bash
aws iam put-user-policy --user-name <your-user> --policy-name AppAutoScalingFull \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"application-autoscaling:*","Resource":"*"}]}'
```

## Environment variables

Only one has to be set by hand.

| Variable | Where | Required | Notes |
| --- | --- | --- | --- |
| `GOOGLE_GEMINI_API_KEY` | `apps/api/.env`, or exported | Yes | Read by `deploy.sh` and written to SSM. Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `FORCE_BUILD` | exported | No | `1` rebuilds images even when the tag already exists in ECR |
| `AWS_REGION` | exported | No | Falls back to `aws configure get region`, then `eu-central-1` |

`deploy.sh` refuses to start without a Gemini key, rather than deploying a
worker that fails every extraction. Surrounding quotes in `.env` are stripped.

**Nothing else is set by hand.** Every variable the containers need -
`DATABASE_CA_CERT`, `JWT_SECRET`, `POSTGRES_*`, `S3_BUCKET`, `WEB_ORIGIN`,
`OTEL_*`, `COOKIE_SECURE` - is written into the ECS task definitions by
Terraform.

## Secrets

Three SSM `SecureString` parameters, resolved by the ECS execution role at task
start:

| Parameter | Created by | Goes to |
| --- | --- | --- |
| `/cv-jobs/jwt-secret` | Terraform (`random_password`) | API, worker |
| `/cv-jobs/database-password` | Terraform (`random_password`) | API, worker, migration task |
| `/cv-jobs/gemini-api-key` | `deploy.sh` | Worker only |

The Gemini key is written by the script rather than Terraform so it never
enters `terraform.tfstate`.

> `terraform.tfstate` is local, gitignored, and contains the generated JWT
> signing key and RDS password in plaintext. Do not commit it.

## Commands

Run from anywhere - the scripts resolve the repository root themselves.

| Command | Description |
| --- | --- |
| `./infra/deploy.sh` | Full deploy at the current commit |
| `./infra/deploy.sh <git-sha>` | Redeploy an earlier image - this is rollback |
| `FORCE_BUILD=1 ./infra/deploy.sh` | Deploy, rebuilding images even if the tag exists |
| `./infra/destroy.sh` | Tear everything down |

Terraform directly, for inspection:

```bash
terraform -chdir=infra/terraform plan -var image_tag=dryrun   # creates nothing
terraform -chdir=infra/terraform output
terraform -chdir=infra/terraform state list
```

### What deploy.sh does

1. Creates the two ECR repositories
2. Builds and pushes both images (skipped if the tag is already in ECR)
3. Writes the Gemini key to SSM
4. Applies the whole configuration with all services at **zero tasks**
5. Runs the migration task once - **stops here on a non-zero exit**
6. Applies again with the real task counts

First run takes 15-20 minutes; RDS and the NAT gateway are most of it.
Subsequent runs are a few minutes.

## Verifying

```bash
curl "$(terraform -chdir=infra/terraform output -raw health_url)"
# {"status":"ok","services":{"database":"up"}}

aws ecs list-tasks --cluster cv-jobs-serving    # 4 tasks: 2 api, 2 web
aws ecs list-tasks --cluster cv-jobs-workers    # 2 tasks

aws logs tail /ecs/cv-jobs/api --follow
aws logs tail /ecs/cv-jobs/worker --follow
```

Open the app with an explicit `http://`. There is no TLS listener, and browsers
upgrade a typed hostname to HTTPS and then report the site as unreachable.

Traces appear in the X-Ray console under **CloudWatch → X-Ray traces → Service
map**, a few minutes after a resume upload.

To open a shell in a running task:

```bash
aws ecs execute-command --cluster cv-jobs-serving --task <task-id> \
  --container api --interactive --command /bin/sh
```

## Tearing down

```bash
./infra/destroy.sh
```

Takes 8-12 minutes. It destroys the stack, deletes the Gemini parameter that
Terraform does not own, and lists anything still tagged `Project=cv-jobs`.

The stack costs roughly **$0.29/hour** while it is up - mostly the NAT gateway,
RDS and six Fargate tasks. Confirm the expensive things are gone:

```bash
aws ec2 describe-nat-gateways --filter Name=state,Values=available --query 'NatGateways[].NatGatewayId' --output text
aws rds describe-db-instances --query 'DBInstances[].DBInstanceIdentifier' --output text
aws ec2 describe-addresses --query 'Addresses[].PublicIp' --output text
```

All three should be empty. An unattached elastic IP keeps billing after
everything around it is gone.

## Terraform variables

| Variable | Default | |
| --- | --- | --- |
| `image_tag` | *required* | Rejects `latest` - rollback depends on immutable tags |
| `aws_region` | `eu-central-1` | |
| `project` | `cv-jobs` | Name prefix and `Project` tag on every resource |
| `api_desired_count` | `2` | |
| `web_desired_count` | `2` | |
| `worker_desired_count` | `2` | |
| `db_instance_class` | `db.t4g.micro` | |
| `db_engine_version` | `17.11` | |
| `adot_image` | `...aws-otel-collector:v0.49.0` | OTLP collector sidecar |
| `log_retention_days` | `1` | |
