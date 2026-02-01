# ECR repository for the server Docker image

resource "aws_ecr_repository" "server" {
  name                 = "${var.project_name}-server"
  image_tag_mutability = "MUTABLE"
  tags                 = { Name = "${var.project_name}-server" }
}
