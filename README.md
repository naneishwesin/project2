## Real-Time Collaborative Platform (Discord-style) — AWS Prototype

This repo is a **student-scale prototype** designed to demonstrate an **enterprise-scale AWS architecture**:

- **WebSocket** real-time text chat
- **WebRTC** voice/video using **WebSocket signaling**
- **RDS (Postgres)** for message history
- **Redis** for presence/session + low-latency caching
- **S3** for uploads (optional in prototype)
- **ALB + ECS + EC2 Auto Scaling Group** (hybrid compute)
- **CloudWatch** dashboards + alarms

### Quick start (local)

Prereqs: Node.js 18+

1. **Start Postgres + Redis** (Postgres uses host port **5433** to avoid conflict with a local Postgres on 5432):
   ```bash
   docker compose up -d
   ```
2. **Create DB schema** (once):
   ```bash
   docker exec -i project2-postgres-1 psql -U postgres -d rtcp < apps/server/src/schema.sql
   ```
   If Postgres wasn’t running before, run `docker compose up -d` again so the postgres container starts.
3. **Config**: copy `apps/server/.env.example` to `apps/server/.env` (defaults use port 5433).
4. **Run the app**:
   ```bash
   npm install
   npm run dev
   ```
5. Open **http://localhost:3001** (web UI). API + WebSocket: **http://localhost:3000**.

### What’s in here

- `apps/server`: Express + Socket.IO (chat + WebRTC signaling), REST endpoints
- `apps/web`: plain HTML/JS frontend (chat + voice/video UI)
- `docs`: architecture diagram, AWS build steps, demo script, cost template

### Deploy to AWS

From **infra/** run Terraform to create VPC, ALB, ECS, EC2 ASG, RDS, Redis, S3 (matches **docs/aws-build-steps.md**):

```bash
cd infra && cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set db_password
terraform init && terraform apply
```

Then build/push the server image to ECR and run schema on RDS. Full steps: **infra/README.md**.

### AWS delivery (for your checklist)

See:
- `docs/architecture.md` — system diagram (SVG + Mermaid), traffic flow, service justification
- `docs/aws-build-steps.md` — Phase 2–5, 9 (VPC, ALB, ECS, ASG, RDS, Redis, S3, CloudWatch)
- `docs/demo-runbook.md` — 6–10 min video script
- `docs/cost-estimate.md` — prototype + enterprise cost
- `docs/CHECK-ALL.md` — verification summary and rubric alignment

