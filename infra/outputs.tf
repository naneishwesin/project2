output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "ALB DNS name — use http://<this> to reach the app"
}

output "alb_url" {
  value       = "http://${aws_lb.main.dns_name}"
  description = "App URL (HTTP; add HTTPS in production with ACM)"
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.server.repository_url
  description = "ECR repository URL — push your Docker image here"
}

output "rds_endpoint" {
  value       = aws_db_instance.main.address
  description = "RDS Postgres endpoint (run schema.sql against this)"
}

output "redis_endpoint" {
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
  description = "ElastiCache Redis endpoint"
}

output "s3_bucket" {
  value       = aws_s3_bucket.uploads.id
  description = "S3 bucket for avatars/uploads"
}

output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.uploads.domain_name
  description = "CloudFront distribution domain (CDN for S3)"
}

output "cloudfront_url" {
  value       = "https://${aws_cloudfront_distribution.uploads.domain_name}"
  description = "CloudFront URL for S3 content (use /path for objects)"
}

output "region" {
  value       = var.aws_region
  description = "AWS region"
}

output "cloudwatch_dashboard_url" {
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
  description = "CloudWatch dashboard URL (system health and resource utilization)"
}
