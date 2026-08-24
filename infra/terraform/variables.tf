variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "project" {
  description = "Name prefix and Project tag on every resource."
  type        = string
  default     = "cv-jobs"
}

variable "image_tag" {
  description = "Tag both images are pulled by. A git SHA - a task definition pinned to a moving tag cannot be rolled back."
  type        = string

  validation {
    condition     = var.image_tag != "latest"
    error_message = "Use an immutable tag (a git SHA), not `latest` - rollback depends on it."
  }
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "web_desired_count" {
  type    = number
  default = 2
}

variable "worker_desired_count" {
  type    = number
  default = 2
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "pgvector is not required - the extension is not enabled."
  type        = string
  default     = "17.11"
}

variable "adot_image" {
  description = "OTLP collector sidecar. Pinned for the same reason the app images are."
  type        = string
  default     = "public.ecr.aws/aws-observability/aws-otel-collector:v0.49.0"
}

variable "log_retention_days" {
  description = "One day: the stack does not outlive an afternoon."
  type        = number
  default     = 1
}
