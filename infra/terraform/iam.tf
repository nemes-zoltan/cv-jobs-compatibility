# Two kinds of role, and the distinction is worth knowing.
#
# The execution role belongs to the ECS agent. It pulls the image, resolves
# secrets and creates log streams - all before the container starts.
#
# The task role belongs to the running process, and is what the AWS SDK inside
# the application picks up. It is why no static key pair appears anywhere in
# this stack: ProductionConfigService leaves `s3Credentials` undefined precisely
# so the SDK walks its provider chain and finds these short-lived credentials.

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- Execution role --------------------------------------------------------

resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    sid       = "ReadTaskSecrets"
    actions   = ["ssm:GetParameters"]
    resources = local.secret_arns
  }

  # SecureString parameters are encrypted with the AWS-managed SSM key, so
  # reading one also needs a decrypt. Scoped by condition rather than by key
  # ARN: naming the key would need a lookup, and the condition is the tighter
  # grant anyway - it allows decryption only when SSM is the caller, not
  # whenever something holds a ciphertext.
  statement {
    sid       = "DecryptViaSsm"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# --- Task role -------------------------------------------------------------

# Shared by the API and the worker. They run the same sources and both reach
# S3 - the API to sign URLs and read objects back, the worker to fetch the file
# it is about to parse - so splitting them would be two identical policies.
resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

data "aws_iam_policy_document" "task" {
  # There is no `s3:HeadObject` action - a HEAD is authorised by `s3:GetObject`,
  # which is how the size check before processing works.
  statement {
    sid       = "ResumeObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.resumes.arn}/*"]
  }

  # Used by the ADOT sidecar, not the application - the application only ever
  # speaks OTLP to localhost. It sits on the task role because a sidecar shares
  # the task's identity.
  statement {
    sid = "PublishTraces"
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "xray:GetSamplingRules",
      "xray:GetSamplingTargets",
      "xray:GetSamplingStatisticSummaries",
    ]
    resources = ["*"]
  }

  # Lets `aws ecs execute-command` open a shell in a running task. Not needed by
  # the application; needed by whoever is working out why it is unhappy, on a
  # stack with no other way in.
  statement {
    sid = "ExecuteCommand"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "runtime"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# The web and migration tasks get no task role. Next.js calls no AWS API - the
# browser talks to S3 directly with a presigned URL - and the migration task
# talks to nothing but Postgres.
