# Provider, state, and the facts the other files read.
#
# This stack is built to be created, demonstrated and destroyed the same day.
# Several choices below are wrong for anything longer-lived and say so where
# they are made.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
    # Only to fetch the RDS CA bundle, which has no data source of its own.
    http = { source = "hashicorp/http", version = "~> 3.4" }
  }

  # State is a local file, gitignored. It holds the generated JWT signing key
  # and the RDS password in plaintext, so it must never be committed.
  #
  # The moment a second person or a CI runner applies this, it needs the backend
  # below instead: shared state, plus a lock so two applies cannot interleave.
  # `use_lockfile` keeps the lock in the same bucket, which is why there is no
  # DynamoDB table here.
  #
  # backend "s3" {
  #   bucket       = "cv-jobs-tfstate-<account-id>"
  #   key          = "demo/terraform.tfstate"
  #   region       = "eu-central-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.aws_region

  # Every resource carries these, which is what makes destroy verifiable:
  # anything left tagged Project=cv-jobs is something that did not get cleaned
  # up. destroy.sh checks exactly that.
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      Ephemeral = "true"
    }
  }
}

# Same region, no default tags.
#
# RegisterScalableTarget sends whatever tags the provider would apply, and doing
# so makes the call require application-autoscaling:TagResource - which this
# account's user does not have. A scalable target is free, is not something you
# would ever hunt for in a bill, and is destroyed with the service it points at,
# so losing the tag on it costs nothing. Granting the permission instead would
# work equally well.
provider "aws" {
  alias  = "untagged"
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name       = var.project
  account_id = data.aws_caller_identity.current.account_id

  # Two AZs: the floor, since an RDS subnet group and an ALB each require
  # subnets in at least two.
  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  # No certificate and no domain, so the load balancer's own DNS name is the
  # origin - what the browser opens, what the API accepts as WEB_ORIGIN, and
  # what the bucket allows a presigned PUT from.
  app_origin = "http://${aws_lb.main.dns_name}"

  api_image = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
  web_image = "${aws_ecr_repository.web.repository_url}:${var.image_tag}"
}
