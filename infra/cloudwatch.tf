# Phase 9 — Monitoring & Observability: Dashboard + Alarms

locals {
  lb_arn_suffix     = aws_lb.main.arn_suffix
  tg_ecs_arn_suffix = aws_lb_target_group.ecs.arn_suffix
  tg_ec2_arn_suffix = aws_lb_target_group.ec2.arn_suffix
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-dashboard"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ALB Request Count"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", local.lb_arn_suffix, { stat = "Sum", period = 60 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ALB Target Response Time"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", local.lb_arn_suffix, { stat = "Average", period = 60 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "ALB Healthy / Unhealthy Hosts (ECS TG)"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", local.tg_ecs_arn_suffix, "LoadBalancer", local.lb_arn_suffix, { stat = "Average", period = 60 }],
            [".", "UnHealthyHostCount", ".", ".", ".", ".", { stat = "Average", period = 60 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "ECS Service CPU"
          region = var.aws_region
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.server.name, { stat = "Average", period = 60 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "EC2 ASG CPU"
          region = var.aws_region
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", aws_autoscaling_group.legacy.name, { stat = "Average", period = 60 }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "RDS CPU & Connections"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.id, { stat = "Average", period = 60 }],
            [".", "DatabaseConnections", ".", ".", { stat = "Average", period = 60 }]
          ]
        }
      }
    ]
  })
}

# Alarms: threshold-based notifications

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_ecs" {
  alarm_name          = "${var.project_name}-alb-unhealthy-ecs"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "ALB ECS target group has unhealthy hosts"
  dimensions = {
    TargetGroup  = local.tg_ecs_arn_suffix
    LoadBalancer = local.lb_arn_suffix
  }
  tags = { Name = "${var.project_name}-alarm-unhealthy-ecs" }
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.project_name}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "ECS service CPU above 85% (scaling should mitigate)"
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.server.name
  }
  tags = { Name = "${var.project_name}-alarm-ecs-cpu" }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.project_name}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU above 80%"
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
  tags = { Name = "${var.project_name}-alarm-rds-cpu" }
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project_name}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "ALB returned 5xx (server errors)"
  dimensions = {
    LoadBalancer = local.lb_arn_suffix
  }
  tags = { Name = "${var.project_name}-alarm-alb-5xx" }
}
