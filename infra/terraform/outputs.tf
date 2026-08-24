output "app_url" {
  description = "Open this. One origin serves the web app and, under /api, the API."
  value       = local.app_origin
}

output "health_url" {
  value = "${local.app_origin}/api/health"
}

output "serving_cluster" {
  value = aws_ecs_cluster.serving.name
}

output "workers_cluster" {
  description = "Where the worker service and the one-off migration task run."
  value       = aws_ecs_cluster.workers.name
}

output "app_subnet_ids" {
  description = "App-tier subnets. The migration task runs here too."
  value       = [for subnet in aws_subnet.app : subnet.id]
}

output "task_security_group_id" {
  value = aws_security_group.tasks.id
}

output "api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "resume_bucket" {
  value = aws_s3_bucket.resumes.id
}

output "database_endpoint" {
  description = "Private - reachable only from the Fargate tasks."
  value       = aws_db_instance.main.address
}
