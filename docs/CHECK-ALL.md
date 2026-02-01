# Project Check — Verification Summary

You use **`apps/`** and **`docs/`** only. **`infra/`** is not used (optional reference). Last checked against: **Technical Requirements**, **Deliverables**, and **Assessment Rubric (100 Marks)**.

---

## 1. Technical Requirements → How You Cover Them

**Prototype (what you run):** `apps/server` + `apps/web` with local Postgres + Redis.  
**Design (what you submit):** `docs/architecture.md`, `docs/system-architecture.svg`, `docs/cost-estimate.md`, `docs/aws-build-steps.md` describe the target AWS architecture. You do **not** use `infra/` Terraform.

### 1.1 Infrastructure & Networking

| Requirement | In your project |
|-------------|-----------------|
| **Custom VPC, Public + Private subnets, ≥2 AZs** | **Design doc** (`docs/architecture.md`, `docs/aws-build-steps.md`): VPC, 2 AZ, public/private subnets, ALB, ECS, RDS, Redis. |
| **Gateway for private instances, secure management (Bastion/identity-aware)** | **Design doc**: NAT, SSM (identity-aware). |
| **Strict firewall / access control** | **Design doc**: SG hierarchy (ALB→APP→DB/Redis). |
| **Load Balancer** | **Design doc**: ALB, target groups. |

### 1.2 Compute & Scaling

| Requirement | In your project |
|-------------|-----------------|
| **Hybrid compute (VMs + Containers)** | **Design doc**: EC2 ASG + ECS Fargate. |
| **Elasticity (scaling policies)** | **Design doc**: CPU-based scaling for ECS and ASG. |

### 1.3 Data Management

| Requirement | In your project |
|-------------|-----------------|
| **Relational DB (HA / Multi-Zone)** | **Prototype:** Postgres (Docker). **Design doc:** RDS Multi-AZ. |
| **NoSQL / Cache (Redis)** | **Prototype:** Redis (Docker) in `apps/server`. **Design doc:** ElastiCache. |
| **Object storage + CDN** | **Design doc:** S3 + CloudFront. |

### 1.4 Monitoring & Observability

| Requirement | In your project |
|-------------|-----------------|
| **Custom dashboards, threshold-based alarms** | **Design doc:** CloudWatch dashboard + alarms (`docs/aws-build-steps.md` Phase 9). |

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

## 3. Assessment Rubric (100 Marks) — Alignment (apps/ + docs/ only)

| Category | Marks | How you address it |
|----------|-------|---------------------|
| **Proposal** | 10 | One-pager: domain, requirements, Free Tier note, team roles (if required). |
| **Architectural Soundness** | 30 | **Design doc** (docs/): VPC, 2 AZ, subnets, HA, security, ALB, ECS, ASG, RDS, Redis, S3, CloudWatch. You document the architecture; you don’t run infra/. |
| **System Functionality** | 20 | **Prototype** (apps/): login, servers/channels, chat, voice/video, state in Postgres + Redis. Run locally with Docker + npm run dev. |
| **Scalability & Resilience** | 25 | **Design doc** describes auto-scaling and failover. **Video:** show app recovery (e.g. restart server, reconnect) or explain from design. |
| **Documentation & Presentation** | 15 | Design doc in docs/; demo runbook; **you** create and give the presentation. |

---

## 4. What You Use vs What You Do

| Item | In repo | You do |
|------|---------|--------|
| **apps/** (backend + frontend) | Full prototype (auth, chat, WebRTC, Discord-style UI, text/voice channels) | Run locally: docker-compose + npm run dev |
| **docs/** (design doc) | architecture.md, system-architecture.svg, cost-estimate.md, aws-build-steps.md | Submit / use in presentation |
| **infra/** | Terraform for AWS (optional reference) | **Not used** |
| **Demo video** | demo-runbook.md script | Record 6–10 min (prototype + fault tolerance) |
| **Presentation** | — | Create slides, 15 min present |

---

## 5. Quick Run (Local)

1. `docker compose up -d` (Postgres 5433, Redis 6379)
2. Apply schema: `docker exec -i project2-postgres-1 psql -U postgres -d rtcp < apps/server/src/schema.sql`
3. `apps/server/.env` from `.env.example` (PGPORT=5433, REDIS_URL)
4. `npm install && npm run dev`
5. Open http://localhost:3001 → login, create server/channel, chat, voice/video

---

## 6. Deploy to AWS (optional)

You are **not** using `infra/`. If you ever want to deploy to AWS, see `docs/aws-build-steps.md` (manual) or `infra/README.md` (Terraform). For this project, **apps/ + docs/** are enough.

All technical requirements are **documented** in docs/ and **implemented in the prototype** (apps/) as far as the application; complete proposal, video, and presentation for submission.
