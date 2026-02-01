# AWS Build Steps (meets teacher checklist)

> **Deploy with Terraform:** See **[infra/README.md](../infra/README.md)** for one-command deploy (`terraform apply`) that creates all resources below.  
> This page is the manual (Console) version; use smallest instances for prototype; keep **Multi-AZ in the diagram + doc** even if you run single-AZ DB for cost.

## Phase 2 — Networking & Security (VPC, Subnets, SGs)

- Create **VPC** (e.g. `10.0.0.0/16`)
- Select **2 Availability Zones**
- Create **Public Subnet A/B** (e.g. `10.0.1.0/24`, `10.0.2.0/24`)
- Create **Private Subnet A/B** (e.g. `10.0.11.0/24`, `10.0.12.0/24`)
- Attach **Internet Gateway (IGW)** to VPC
- Route tables:
  - **Public RT**: `0.0.0.0/0 -> IGW`, associate with public subnets
  - **Private RT**: no direct internet route (add NAT only if you need outbound updates)

### Security Groups (strict)

- **SG-ALB**
  - Inbound: `443` from `0.0.0.0/0`
  - Outbound: to **SG-APP** on app ports (e.g., `3000`)
- **SG-APP** (ECS tasks + EC2 instances)
  - Inbound: app port from **SG-ALB only**
  - Outbound: to **SG-DB** `5432`, to **SG-REDIS** `6379`
- **SG-DB**
  - Inbound: `5432` from **SG-APP only**
- **SG-REDIS**
  - Inbound: `6379` from **SG-APP only**

### Secure management access
- Use **SSM Session Manager** for EC2 (no public SSH).

## Phase 3 — Load Balancer (ALB)

- Create **Application Load Balancer** in both **public subnets**
- Listener: `443` (ACM cert) + (optional `80` redirect to `443`)
- Target groups:
  - **TG-ECS** (IP target type) health check: `/health`
  - **TG-EC2** (instance target type) health check: `/health`
- Rules:
  - `/socket.io/*` and `/api/*` → **TG-ECS**
  - `/legacy/*` (optional) → **TG-EC2**

## Phase 4 — Hybrid Compute

### 4A — EC2 Auto Scaling Group (VM service)

- Create **Launch Template**
  - instance: `t3.micro`
  - IAM role: `AmazonSSMManagedInstanceCore`
  - Security group: **SG-APP**
  - User data: install Node + run a tiny REST app exposing `/health` (or your legacy endpoints)
- Create **Auto Scaling Group**
  - subnets: private A/B
  - attach to **TG-EC2**
  - min=1, desired=1, max=2
  - scaling policy: CPU > threshold → scale out

### 4B — ECS Service (chat + signaling)

- Create **ECS Cluster**
- Create **Task Definition**
  - container image: your backend (chat + signaling)
  - env vars: `JWT_SECRET`, `PG*`, `REDIS_URL`, `WEB_ORIGIN`
  - health check uses `/health`
- Create **ECS Service**
  - subnets: private A/B
  - SG: **SG-APP**
  - attach to **TG-ECS**
  - desired tasks=1 (start)
  - scaling policy: CPU > threshold → add tasks

## Phase 5 — Data

### RDS (Postgres)
- Create **RDS Postgres**
  - private subnets
  - **not publicly accessible**
  - SG: **SG-DB**
  - Multi-AZ in design (prototype can be single-AZ)
- Run `apps/server/src/schema.sql` once to create tables.

### Redis (ElastiCache)
- Create **ElastiCache Redis**
  - private subnets
  - SG: **SG-REDIS**

### S3 + CloudFront (optional but recommended in design)
- Create **S3 bucket** for avatars/uploads
- Optional **CloudFront** in front of S3 (global distribution)

## Phase 9 — Monitoring & Alerts

- Create **CloudWatch Dashboard**
  - ALB RequestCount, TargetResponseTime, HealthyHostCount/UnHealthyHostCount
  - EC2 CPUUtilization (ASG)
  - ECS CPU/Memory (Service)
  - (optional) RDS connections, Redis CPU
- Create **CloudWatch Alarms**
  - ALB `UnHealthyHostCount > 0`
  - EC2 CPU > threshold
  - ECS CPU > threshold

**Terraform:** `infra/cloudwatch.tf` creates the dashboard and threshold-based alarms (unhealthy hosts, ECS CPU, RDS CPU, ALB 5xx). After apply: `terraform -chdir=infra output cloudwatch_dashboard_url`.

