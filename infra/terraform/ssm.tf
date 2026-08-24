# Secrets, in SSM Parameter Store.
#
# Not Secrets Manager: standard SSM parameters are free, including SecureString
# with the AWS-managed key, and nothing here needs the rotation or replication
# that Secrets Manager charges $0.40/secret/month for. ECS reads both through
# the identical mechanism - a `secrets` block naming an ARN, resolved by the
# execution role before the container starts - so the application cannot tell
# which was used.
#
# The split below is the part worth defending.
#
# The JWT signing key and the database password are born with this stack and
# worthless once it is destroyed, so Terraform generates them. They land in
# terraform.tfstate, which is local and gitignored.
#
# The Gemini API key is yours, outlives the stack, and has billing attached, so
# it must never enter state. Terraform does not create it: deploy.sh writes it
# with `aws ssm put-parameter` and Terraform only ever names it. Reading it back
# with a data source would pull the plaintext into state and defeat the point,
# which is why the ARN below is constructed rather than looked up.

resource "random_password" "jwt_secret" {
  length  = 48
  special = true
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/${local.name}/jwt-secret"
  description = "Signs access and refresh tokens. Regenerated on every create."
  type        = "SecureString"
  value       = random_password.jwt_secret.result
}

resource "aws_ssm_parameter" "database_password" {
  name        = "/${local.name}/database-password"
  description = "RDS master password."
  type        = "SecureString"
  value       = random_password.database.result
}

locals {
  gemini_api_key_name = "/${local.name}/gemini-api-key"
  gemini_api_key_arn  = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter${local.gemini_api_key_name}"

  secret_arns = [
    aws_ssm_parameter.jwt_secret.arn,
    aws_ssm_parameter.database_password.arn,
    local.gemini_api_key_arn,
  ]
}
