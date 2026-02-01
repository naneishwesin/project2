# Cost Estimate (monthly) — Discord-Style Real-Time Platform

> Numbers are indicative for **us-east-1** (or your region). Prototype uses smallest sizes; design includes enterprise-ready components.

## Prototype (student-scale / smallest sizes)

- **ALB**: ~$16–22/month (ALB hours + LCU usage)
- **ECS/Fargate (1 task, 0.25 vCPU, 0.5 GB)** OR ECS on EC2: ~$15–20/month (Fargate) or ~$8 (t3.micro)
- **EC2 ASG (1× t3.micro)**: ~$8/month
- **RDS Postgres (db.t3.micro, single-AZ)**: ~$15/month (single-AZ in demo; Multi-AZ in design)
- **ElastiCache Redis (cache.t3.micro, single node)**: ~$12/month
- **S3 storage**: ~$1–5/month (depends on GB stored; first 5 GB free tier)
- **CloudWatch**: ~$3–10/month (dashboards + alarms + logs; free tier covers partial)
- **Data transfer**: ~$0–5/month (first 100 GB out free tier)

**Prototype total:** ~$70–95/month (or lower with Free Tier: 750 h EC2, 750 h RDS, etc. in first 12 months)

## Enterprise projection (high-traffic)

- **Multi-AZ RDS** with larger instance class (e.g. db.r5.large) + storage + IOPS: ~$300–800/month
- **ElastiCache** cluster mode (replication): ~$100–300/month
- **ECS service** scaled across many tasks and AZs: ~$200–500/month
- **Multiple EC2 instances** in ASG (legacy workloads): ~$100–300/month
- **CloudFront** + higher data egress: ~$50–200/month
- **Centralized logging + tracing** (CloudWatch Logs, X-Ray): ~$20–100/month

**Enterprise total:** ~$770–2,200/month (depends heavily on concurrency, bandwidth, and region). Key cost drivers: compute (ECS/EC2), RDS, data transfer.

## Free Tier (first 12 months, new AWS accounts)

- EC2: 750 h/month t2.micro or t3.micro
- RDS: 750 h/month db.t2.micro or db.t3.micro
- ElastiCache: 750 h/month cache.t2.micro (if eligible)
- S3: 5 GB storage, 20,000 GET, 2,000 PUT
- Data transfer: 100 GB out/month

Use Free Tier where possible for the prototype to minimize cost; document “enterprise projection” in the design doc for full marks.
