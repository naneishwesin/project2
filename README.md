## Real-Time Collaborative Platform (Discord-style)

**What you use:** `apps/` (backend + frontend) and `docs/` (architecture, cost, demo script). Run locally with Docker + Node.

- **Text channels** and **voice channels** (Discord-style): chat in text channels, join voice channels for real-time audio
- **WebSocket** real-time text chat
- **WebRTC** voice/video using **WebSocket signaling**
- **Postgres** (local Docker) for message history
- **Redis** (local Docker) for presence/session + low-latency caching

The **design document** in `docs/` describes the target AWS architecture (VPC, ALB, ECS, RDS, Redis, S3, CloudWatch). **infra/** is optional reference (Terraform) if you ever want to deploy to AWS; you are not required to use it.

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
   For an existing DB without a `type` column on `channels`, run:
   `docker exec -i project2-postgres-1 psql -U postgres -d rtcp < apps/server/src/migration-channel-type.sql`
   If Postgres wasn’t running before, run `docker compose up -d` again so the postgres container starts.
3. **Config**: copy `apps/server/.env.example` to `apps/server/.env` (defaults use port 5433).
4. **Run the app**:
   ```bash
   npm install
   npm run dev
   ```
5. Open **http://localhost:3001** (web UI). API + WebSocket: **http://localhost:3000**.

### What you use

- **`apps/server`** — Express + Socket.IO (chat + WebRTC signaling), REST API, Postgres + Redis
- **`apps/web`** — plain HTML/JS frontend (Discord-style UI, text/voice channels, chat, voice/video)
- **`docs/`** — architecture diagram, service justification, cost estimate, demo video script

### Docs (for your submission)

- `docs/architecture.md` — system diagram (SVG + Mermaid), traffic flow, service justification
- `docs/system-architecture.svg` — diagram image
- `docs/cost-estimate.md` — monthly cost (prototype + enterprise)
- `docs/aws-build-steps.md` — target AWS architecture (manual build steps; for design reference)
- `docs/demo-runbook.md` — script for your 6–10 min demo video
- `docs/SUBMISSION-CHECKLIST.md` — what’s done vs what you still do

**`infra/`** — Optional. Terraform for the same AWS design; use only if you want to deploy to AWS. You are not using it for this project.

