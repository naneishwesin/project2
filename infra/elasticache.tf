# ElastiCache subnet group (PRIVATE subnets)
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-redis-subnet"
  }
}

# Redis cluster
resource "aws_elasticache_cluster" "main" {
  cluster_id         = "${var.project_name}-redis"
  engine             = "redis"
  engine_version     = "7.0"
  node_type          = "cache.t3.micro"
  num_cache_nodes    = 1

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  port = 6379

  tags = {
    Name = "${var.project_name}-redis"
  }
}
