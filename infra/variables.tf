variable "aws_region" {
  default     = "ap-southeast-1"
  description = "AWS region (e.g. ap-southeast-1, us-east-1)"
}

variable "project_name" {
  default     = "rtcp"
  description = "Project name prefix for resources"
}

variable "app_port" {
  default     = 3000
  description = "Port the app listens on"
}

variable "ecs_desired_count" {
  default     = 1
  description = "Desired ECS task count"
}

variable "asg_min_size" {
  default     = 1
  description = "EC2 ASG min size"
}

variable "asg_max_size" {
  default     = 2
  description = "EC2 ASG max size"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS Postgres master password"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  default     = "change-me-in-production"
  description = "JWT secret for auth"
}

variable "web_origin" {
  default     = "*"
  description = "CORS WEB_ORIGIN (ALB URL or frontend URL)"
}

variable "ecr_image_tag" {
  default     = "latest"
  description = "Docker image tag to deploy (e.g. latest)"
}

variable "rds_multi_az" {
  type        = bool
  default     = true
  description = "Enable RDS Multi-AZ for High Availability (set false for cheaper dev)"
}
