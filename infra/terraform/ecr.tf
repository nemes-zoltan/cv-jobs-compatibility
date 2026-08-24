# The two image repositories.
#
# These have to exist and hold an image before the services can be created - a
# service with nothing to pull never reaches a steady state. deploy.sh handles
# that with a targeted apply against just these two, then pushes, then applies
# the rest. They stay in Terraform rather than being made by the script so that
# destroy really does leave the account empty.

resource "aws_ecr_repository" "api" {
  name = "${local.name}-api"

  # Destroy fails on a repository still holding images, which it always is.
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "web" {
  name         = "${local.name}-web"
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

locals {
  keep_last_five = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the five most recent images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 5 }
      action       = { type = "expire" }
    }]
  })
}

# Each deploy pushes a new SHA-tagged image and nothing removes the old one.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy     = local.keep_last_five
}

resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name
  policy     = local.keep_last_five
}
