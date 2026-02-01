# Phase 4A — EC2 Auto Scaling Group (legacy /health service)

# IAM instance profile for SSM (no Bastion)
resource "aws_iam_role" "ec2_ssm" {
  name = "${var.project_name}-ec2-ssm"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_ssm" {
  name = "${var.project_name}-ec2-ssm"
  role = aws_iam_role.ec2_ssm.name
}

# User data: minimal Python HTTP server with /health (for target group health check)
locals {
  ec2_user_data = <<-EOT
#!/bin/bash
yum install -y python3
cat > /tmp/health.py << 'PYEOF'
from http.server import HTTPServer, BaseHTTPRequestHandler
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        ok = self.path == "/health"
        self.send_response(200 if ok else 404)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}' if ok else b'')
HTTPServer(("0.0.0.0", ${var.app_port}), H).serve_forever()
PYEOF
nohup python3 /tmp/health.py &
EOT
}

resource "aws_launch_template" "legacy" {
  name_prefix   = "${var.project_name}-legacy-"
  image_id      = data.aws_ami.amazon_linux_2.id
  instance_type = "t3.micro"
  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [aws_security_group.app.id]
  }
  iam_instance_profile = { arn = aws_iam_instance_profile.ec2_ssm.arn }
  user_data            = base64encode(local.ec2_user_data)
  tag_specifications {
    resource_type = "instance"
    tags = { Name = "${var.project_name}-legacy" }
  }
  tags = { Name = "${var.project_name}-legacy" }
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_autoscaling_group" "legacy" {
  name                = "${var.project_name}-legacy-asg"
  vpc_zone_identifier = aws_subnet.private[*].id
  target_group_arns   = [aws_lb_target_group.ec2.arn]
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size
  desired_capacity    = var.asg_min_size
  health_check_type   = "ELB"
  health_check_grace_period = 120
  launch_template {
    id      = aws_launch_template.legacy.id
    version = "$Latest"
  }
  tag {
    key                 = "Name"
    value               = "${var.project_name}-legacy"
    propagate_at_launch = true
  }
}

# Scaling: CPU > 70% -> add instance
resource "aws_autoscaling_policy" "legacy_cpu" {
  name                   = "${var.project_name}-legacy-cpu"
  policy_type            = "TargetTrackingScaling"
  autoscaling_group_name = aws_autoscaling_group.legacy.name
  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
