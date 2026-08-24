# Four runtimes from two images, across two clusters.
#
# Three of the four are the same API image started with different commands -
# HTTP server, queue worker, one-off migration - because all three build from
# the same sources and share the config, database client, storage client and
# schema.
#
# The cluster split is `serving` for anything behind the load balancer and
# `workers` for anything that is not. Worth being precise about what that buys,
# because it is easy to overclaim: with Fargate a cluster is a namespace, not a
# compute boundary. No instances are attached to it, and every task already runs
# in its own AWS-managed microVM, so the API and the worker are isolated from
# each other either way. What two clusters give is operational and IAM
# separation - a policy or an `update-service` scoped to one cannot touch the
# other. On EC2 launch type it would also mean two separate instance fleets,
# and there the isolation argument would be real.

resource "aws_ecs_cluster" "serving" {
  name = "${local.name}-serving"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_ecs_cluster" "workers" {
  name = "${local.name}-workers"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "serving" {
  cluster_name       = aws_ecs_cluster.serving.name
  capacity_providers = ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

resource "aws_ecs_cluster_capacity_providers" "workers" {
  cluster_name       = aws_ecs_cluster.workers.name
  capacity_providers = ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# --- Shared container configuration ---------------------------------------

locals {
  # Discrete values rather than DATABASE_URL, because the password has to arrive
  # through `secrets` and cannot be interpolated into a connection string here.
  # resolveDatabaseUrl assembles them and percent-encodes the password.
  database_environment = [
    { name = "POSTGRES_HOST", value = aws_db_instance.main.address },
    { name = "POSTGRES_PORT", value = tostring(aws_db_instance.main.port) },
    { name = "POSTGRES_USER", value = aws_db_instance.main.username },
    { name = "POSTGRES_DB", value = aws_db_instance.main.db_name },
  ]

  database_secrets = [
    { name = "POSTGRES_PASSWORD", valueFrom = aws_ssm_parameter.database_password.arn },
  ]

  # Everything BaseConfigService reads eagerly. It captures these when it is
  # constructed and `requireEnv` throws on a missing one, so anything left out
  # here is a container that exits at startup rather than misbehaving later.
  # The worker needs the auth settings too, despite never issuing a token,
  # because it builds the same config object.
  application_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "ACCESS_TOKEN_TTL", value = "600" },
    { name = "REFRESH_TOKEN_TTL", value = "604800" },
    { name = "S3_BUCKET", value = aws_s3_bucket.resumes.id },
    { name = "S3_REGION", value = var.aws_region },
    { name = "UPLOAD_URL_TTL", value = "300" },
    # Public certificate chain, not a secret - see rds.tf.
    { name = "DATABASE_CA_CERT", value = data.http.rds_ca_bundle.response_body },
  ]

  application_secrets = [
    { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
  ]

  log_configuration = {
    for service in ["api", "web", "worker", "migrate"] : service => {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services[service].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = service
      }
    }
  }

  # App tier, no public address. Outbound goes through the NAT gateway.
  task_network = {
    subnets          = [for subnet in aws_subnet.app : subnet.id]
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }
}

# --- API -------------------------------------------------------------------

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name         = "api"
      image        = local.api_image
      essential    = true
      portMappings = [{ containerPort = 4000, protocol = "tcp" }]

      environment = concat(local.application_environment, local.database_environment, local.telemetry_environment, [
        { name = "PORT", value = "4000" },
        # Same host as the web app, so CORS never applies between them. Still
        # has to be set - main.ts passes it to enableCors.
        { name = "WEB_ORIGIN", value = local.app_origin },
        { name = "OTEL_SERVICE_NAME", value = "cv-jobs-api" },
        # No certificate on the load balancer, so a Secure cookie would be
        # discarded and every sign-in would leave no session.
        { name = "COOKIE_SECURE", value = "false" },
      ])

      secrets          = concat(local.application_secrets, local.database_secrets)
      logConfiguration = local.log_configuration["api"]
    },
    local.adot_sidecar,
  ])
}

resource "aws_ecs_service" "api" {
  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.serving.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.task_network.subnets
    security_groups  = local.task_network.security_groups
    assign_public_ip = local.task_network.assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 4000
  }

  # Long enough for Nest to boot and open the pool before a health check counts
  # against the task.
  health_check_grace_period_seconds = 60

  # A deployment that cannot stabilise rolls itself back rather than retrying
  # forever. Without it, a bad image is discovered by noticing the apply hung.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true

  depends_on = [aws_lb_listener.http]
}

# --- Worker ----------------------------------------------------------------

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = local.api_image
      essential = true
      command   = ["node", "dist-worker/main.js"]

      environment = concat(local.application_environment, local.database_environment, local.telemetry_environment, [
        { name = "OTEL_SERVICE_NAME", value = "cv-jobs-worker" },
      ])

      # The one secret the API deliberately does not get. Only the worker calls
      # Gemini, which is why config.service.ts makes geminiApiKey a getter.
      secrets = concat(local.application_secrets, local.database_secrets, [
        { name = "GOOGLE_GEMINI_API_KEY", valueFrom = local.gemini_api_key_arn },
      ])

      logConfiguration = local.log_configuration["worker"]
    },
    local.adot_sidecar,
  ])
}

# Two instances is safe without any code change: both run pg-boss with
# supervise, but pg-boss guards maintenance with pg_advisory_xact_lock and
# claims cron intervals in the database, so only one wins each round. Job
# claiming was already exclusive.
resource "aws_ecs_service" "worker" {
  name            = "${local.name}-worker"
  cluster         = aws_ecs_cluster.workers.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.task_network.subnets
    security_groups  = local.task_network.security_groups
    assign_public_ip = local.task_network.assign_public_ip
  }

  # No load balancer: it takes work from the queue, not from a request.

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true
}

# --- Web -------------------------------------------------------------------

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn

  # No task role: the Next.js server calls no AWS API.

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name         = "web"
      image        = local.web_image
      essential    = true
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]

      # NEXT_PUBLIC_API_URL is absent on purpose: it is baked in at build time
      # and its default, /api, is relative, so the browser resolves it against
      # whatever origin served the page.
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
      ]

      logConfiguration = local.log_configuration["web"]
    },
  ])
}

resource "aws_ecs_service" "web" {
  name            = "${local.name}-web"
  cluster         = aws_ecs_cluster.serving.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.task_network.subnets
    security_groups  = local.task_network.security_groups
    assign_public_ip = local.task_network.assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  health_check_grace_period_seconds = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http]
}

# --- Migrations ------------------------------------------------------------

# Defined here, never scheduled here. Nothing migrates on boot, so deploy.sh
# runs one copy of this in the workers cluster and refuses to bring the services
# up unless it exits 0.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "migrate"
      image     = local.api_image
      essential = true
      command   = ["node", "dist-migrate/main.js"]

      # Deliberately short: migrate.ts never builds the Nest application and
      # never constructs BaseConfigService, so it needs the database and nothing
      # else - no signing key, no bucket, no token lifetimes.
      environment = concat(local.database_environment, [
        { name = "NODE_ENV", value = "production" },
      ])

      secrets          = local.database_secrets
      logConfiguration = local.log_configuration["migrate"]
    },
  ])
}

# --- Autoscaling -----------------------------------------------------------

# CPU, which is the honest signal available. The worker is left alone: it should
# scale on queue depth, and nothing publishes that metric yet.
#
# Skipped entirely while a service is held at zero, which is how deploy.sh
# stands the infrastructure up before the schema exists: a scaling target with
# a floor and ceiling of zero is not a meaningful thing to create.
resource "aws_appautoscaling_target" "service" {
  # Untagged - see the aliased provider in main.tf.
  provider = aws.untagged

  for_each = {
    for name, config in {
      api = { service = aws_ecs_service.api.name, min = var.api_desired_count }
      web = { service = aws_ecs_service.web.name, min = var.web_desired_count }
    } : name => config if config.min > 0
  }

  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.serving.name}/${each.value.service}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = each.value.min
  max_capacity       = each.value.min * 2
}

resource "aws_appautoscaling_policy" "service_cpu" {
  provider = aws.untagged

  for_each = aws_appautoscaling_target.service

  name               = "${local.name}-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = each.value.service_namespace
  resource_id        = each.value.resource_id
  scalable_dimension = each.value.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value = 60

    # Quick to add, slow to remove: a scale-in racing a traffic spike costs more
    # than the minute of over-provisioning it saves.
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
  }
}
