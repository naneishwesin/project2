# Project Check — Verification Summary

Last checked against: **Technical Requirements**, **Deliverables**, and **Assessment Rubric (100 Marks)**.

---

## 1. Technical Requirements → Implementation

### 1.1 Infrastructure & Networking

| Requirement | Implementation | Where |
|-------------|----------------|--------|
| **Custom VPC, Public + Private subnets across ≥2 AZs** | VPC 10.0.0.0/16, 2 AZs, public subnets (ALB), private subnets (ECS, EC2, RDS, Redis) | `infra/vpc.tf`, design in `architecture.md` |
| **Gateway services for private instances** | NAT Gateway so private instances can reach internet (ECR, etc.) | `infra/vpc.tf` |
| **Secure management access (Bastion or identity-aware proxy)** | **SSM Session Manager** on EC2 — no Bastion; identity-aware, no SSH keys | `infra/ec2-asg.tf` (IAM `AmazonSSMManagedInstanceCore`), `aws-build-steps.md` |
| **Strict firewall / access control** | SG-ALB → SG-APP only; SG-APP → SG-DB 5432, SG-REDIS 6379; no public DB/Redis | `infra/security-groups.tf` |
| **Load Balancer** | Application Load Balancer, TG-ECS + TG-EC2, rules for /api, /socket.io, /health, /legacy | `infra/alb.tf` |

### 1.2 Compute & Scaling

| Requirement | Implementation | Where |
|-------------|----------------|--------|
| **Hybrid compute (VMs + Containers)** | EC2 Auto Scaling Group (legacy /health) + ECS Fargate (chat + signaling) | `infra/ec2-asg.tf`, `infra/ecs.tf` |
| **Elasticity (scaling policies)** | ASG: CPU > 70% → scale out; ECS: CPU > 70% → add tasks | `infra/ec2-asg.tf`, `infra/ecs.tf` |

### 1.3 Data Management

| Requirement | Implementation | Where |
|-------------|----------------|--------|
| **Relational DB (HA / Multi-Zone)** | RDS Postgres with **Multi-AZ** (variable `rds_multi_az`, default true) | `infra/rds.tf`, `infra/variables.tf` |
| **NoSQL / Cache (Redis)** | ElastiCache Redis, SG-REDIS from SG-APP only | `infra/elasticache.tf` |
| **Object storage + CDN** | S3 bucket + **CloudFront** distribution (OAC) for global distribution | `infra/s3.tf`, `infra/cloudfront.tf` |

### 1.4 Monitoring & Observability

| Requirement | Implementation | Where |
|-------------|----------------|--------|
| **Custom monitoring dashboards** | CloudWatch dashboard: ALB RequestCount, TargetResponseTime, Healthy/UnHealthy hosts, ECS CPU, EC2 ASG CPU, RDS CPU & connections | `infra/cloudwatch.tf` |
| **Threshold-based alarms** | Alarms: ALB UnHealthyHostCount > 0, ECS CPU > 85%, RDS CPU > 80%, ALB 5xx count > 0 | `infra/cloudwatch.tf` |

---

## 2. Deliverables (3 items)

| Deliverable | Status | Location |
|-------------|--------|----------|
| **1. Architectural Design Document** | ✓ | `docs/architecture.md`, `docs/system-architecture.svg`, `docs/cost-estimate.md` |
| System diagram (infra, networking, traffic) | ✓ | SVG + Mermaid in architecture.md |
| Service justification | ✓ | architecture.md “Service Justification” |
| Cost estimation (monthly) | ✓ | cost-estimate.md (prototype + enterprise) |
| **2. Live System Demonstration Video** | Script ready; **you** record | `docs/demo-runbook.md` — walkthrough, fault tolerance (stop server/zone), scaling |
| **3. Final Presentation** | Outline in rubric; **you** create slides | 15 min: architecture, biggest challenge, high availability |

---

## 3. Assessment Rubric (100 Marks) — Alignment

| Category | Marks | How the project addresses it |
|----------|-------|-------------------------------|
| **Proposal** | 10 | One-pager: domain, requirements, Free Tier note, team roles (if required). |
| **Architectural Soundness** | 30 | **Networking:** VPC, 2 AZ, public/private subnets. **HA:** RDS Multi-AZ, ECS/ASG across subnets. **Security:** SG hierarchy (ALB→APP→DB/Redis), SSM for management (no Bastion). All in Terraform + design doc. |
| **System Functionality** | 20 | App: login, servers/channels, real-time chat, history, voice/video. State in RDS + Redis; correct across zones when deployed. Prototype runs locally; deploy with `infra/` for AWS. |
| **Scalability & Resilience** | 25 | **Auto-scaling:** ECS + ASG CPU-based policies (Terraform). **Failover:** Demo in video — stop task/instance, ALB shifts traffic; RDS Multi-AZ; WebRTC P2P survives signaling restart. |
| **Documentation & Presentation** | 15 | Design doc (diagram, justification, cost); demo runbook; clear presentation (architecture, challenge, HA). |

---

## 4. What’s in Code vs What You Do

| Item | In repo | You do |
|------|---------|--------|
| **Infra (Terraform)** | VPC, ALB, ECS, EC2 ASG, RDS (Multi-AZ), Redis, S3, CloudFront, CloudWatch dashboard + alarms | `terraform init/apply`, set `terraform.tfvars`, build/push image, run schema on RDS |
| **Backend / Frontend** | Full prototype (auth, chat, WebRTC, Discord-style UI) | Run locally or point frontend at ALB after deploy |
| **Design doc** | architecture.md, system-architecture.svg, cost-estimate.md | Submit / present |
| **Demo video** | demo-runbook.md script | Record 6–10 min with fault-tolerance and scaling evidence |
| **Presentation** | Rubric alignment above | Create slides, 15 min present |

---

## 5. Quick Run (Local)

1. `docker compose up -d` (Postgres 5433, Redis 6379)
2. Apply schema: `docker exec -i project2-postgres-1 psql -U postgres -d rtcp < apps/server/src/schema.sql`
3. `apps/server/.env` from `.env.example` (PGPORT=5433, REDIS_URL)
4. `npm install && npm run dev`
5. Open http://localhost:3001 → login, create server/channel, chat, voice/video

---

## 6. Deploy to AWS (when you need to show the system)

See **`infra/README.md`**: configure `terraform.tfvars`, `terraform init && terraform apply`, build/push image to ECR, run schema on RDS, open ALB URL. Optional: `terraform -chdir=infra output cloudwatch_dashboard_url` for the dashboard; CloudFront URL for S3 content.

All technical requirements and rubric criteria are **designed and implemented** in code/docs; complete proposal, video, and presentation for submission.
