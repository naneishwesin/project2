# Phase 5 — RDS Postgres (private subnets, single-AZ for cost)

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project_name}-db-subnet" }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-postgres"
  engine         = "postgres"
  engine_version = "15"
  instance_class = "db.t3.micro"
  allocated_storage = 20
  storage_type   = "gp2"
  db_name  = "rtcp"
  username = "postgres"
  password = var.db_password
  port     = 5432
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az              = var.rds_multi_az
  skip_final_snapshot   = true
  tags                  = { Name = "${var.project_name}-rds" }
}
