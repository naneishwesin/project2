# Phase 3 — Application Load Balancer (public subnets)

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  tags               = { Name = "${var.project_name}-alb" }
}

# Target group for ECS (IP target type for Fargate)
resource "aws_lb_target_group" "ecs" {
  name        = "${var.project_name}-tg-ecs"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
  tags = { Name = "${var.project_name}-tg-ecs" }
}

# Target group for EC2 (instance target type)
resource "aws_lb_target_group" "ec2" {
  name        = "${var.project_name}-tg-ec2"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"
  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
  tags = { Name = "${var.project_name}-tg-ec2" }
}

# Listener HTTP :80 (for prototype; add ACM + 443 for production)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs.arn
  }
}

# Forward /api/* and /socket.io/* to ECS; /legacy/* to EC2
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs.arn
  }
  condition {
    path_pattern {
      values = ["/api/*", "/socket.io/*", "/health", "/"]
    }
  }
}

resource "aws_lb_listener_rule" "legacy" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 200
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ec2.arn
  }
  condition {
    path_pattern {
      values = ["/legacy/*"]
    }
  }
}
