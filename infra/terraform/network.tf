# A three-tier VPC across two availability zones.
#
#   public   ALB and the NAT gateway. The only tier with a route from the
#            internet.
#   app      Fargate tasks. No public address; outbound only, through NAT.
#   data     RDS. No route off the VPC in either direction.
#
# The tiers are enforced twice over - by routing, and by the security group
# chain at the bottom of this file. Each security group names the one before it
# rather than a CIDR range, so the rules keep holding as addresses change and
# the chain reads as one sentence: the internet reaches the load balancer, the
# load balancer reaches the tasks, the tasks reach the database, and nothing
# skips a step.

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.name }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = local.name }
}

locals {
  # index -> AZ, so each tier can lay its subnets out consistently.
  az_index = { for index, az in local.azs : az => index }
}

resource "aws_subnet" "public" {
  for_each = local.az_index

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, each.value)
  map_public_ip_on_launch = true

  tags = { Name = "${local.name}-public-${each.key}", Tier = "public" }
}

resource "aws_subnet" "app" {
  for_each = local.az_index

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, each.value + 10)

  tags = { Name = "${local.name}-app-${each.key}", Tier = "app" }
}

resource "aws_subnet" "data" {
  for_each = local.az_index

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, each.value + 20)

  tags = { Name = "${local.name}-data-${each.key}", Tier = "data" }
}

# --- Routing ---------------------------------------------------------------

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${local.name}-nat" }
}

# One NAT, not one per AZ. Two would survive an AZ failure; this stack is
# destroyed the same day and an AZ outage during the demo is a risk worth
# taking to halve the cost of the most expensive thing here.
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[local.azs[0]].id

  depends_on = [aws_internet_gateway.main]

  tags = { Name = local.name }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# Outbound only. This is what lets the tasks pull from ECR, read SSM, reach S3
# and X-Ray, and call the Gemini API without being addressable themselves.
resource "aws_route_table" "app" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = { Name = "${local.name}-app" }
}

resource "aws_route_table_association" "app" {
  for_each = aws_subnet.app

  subnet_id      = each.value.id
  route_table_id = aws_route_table.app.id
}

# The data tier gets no route table of its own, so it inherits the VPC-local
# one: reachable inside the VPC, with no path to or from the internet.

# --- Security groups -------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Public entry point. Port 80 only - this deployment has no certificate."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from anywhere"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  description       = "Forwarding and health checks to the tasks"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "tasks" {
  name        = "${local.name}-tasks"
  description = "Fargate tasks. Inbound from the load balancer only."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-tasks" }
}

resource "aws_vpc_security_group_ingress_rule" "tasks_api" {
  security_group_id            = aws_security_group.tasks.id
  description                  = "API port, from the load balancer only"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 4000
  to_port                      = 4000
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "tasks_web" {
  security_group_id            = aws_security_group.tasks.id
  description                  = "Web port, from the load balancer only"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}

# The worker has no inbound rule at all - nothing connects to it. It shares this
# group because its outbound needs are identical.
resource "aws_vpc_security_group_egress_rule" "tasks_all" {
  security_group_id = aws_security_group.tasks.id
  description       = "ECR, SSM, S3, X-Ray, Gemini - all via NAT"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "Postgres. Reachable from the tasks and from nowhere else."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-database" }
}

resource "aws_vpc_security_group_ingress_rule" "database_from_tasks" {
  security_group_id            = aws_security_group.database.id
  description                  = "Postgres from the Fargate tasks"
  referenced_security_group_id = aws_security_group.tasks.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

# No egress rule on the database group. Postgres answers on the connection it
# accepted; it never opens one.
