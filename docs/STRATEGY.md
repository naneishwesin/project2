# Project strategy (what gets full marks)

- **Design on AWS** — You describe and draw the cloud architecture (VPC, ALB, ECS, RDS, Redis, S3, CloudWatch, HA, security). No AWS account required.
- **Demo locally with Docker** — You run the prototype with Docker (Postgres, Redis, optional load-balanced backends) and record the video.

You are **not** required to deploy real AWS. You **are** required to show cloud-architecture thinking and prove concepts (scalability, failover) in the design and in the demo.

---

## What you have

| Layer | Design (AWS-style) | Implementation (what you run) |
|-------|---------------------|--------------------------------|
| **Architecture** | `docs/architecture.md`, `docs/system-architecture.svg`, `docs/aws-build-steps.md` | — |
| **Compute** | ECS, EC2 ASG | Node server (`apps/server`) |
| **Network / LB** | VPC, ALB | Optional: Nginx in Docker (`docker-compose.fault-demo.yml`) |
| **Database** | RDS Multi-AZ | Postgres container |
| **Cache** | ElastiCache | Redis container |
| **HA / failover** | Multi-AZ, ALB health checks | Kill one backend container, show app still works |
| **Scaling** | Auto Scaling policies | Optional: `docker compose up --scale server=2` |
| **Cost** | `docs/cost-estimate.md` | Theoretical (no billing) |

---

## Fault-tolerance demo (Docker-only)

Two options for the video:

1. **Simple:** Run app normally (Docker + `npm run dev`). Stop the Node server (Ctrl+C). Show “disconnected”. Restart server. Show reconnection and that chat/history still work (state in Postgres/Redis). ✅ Proves recovery.
2. **Stronger:** Use `docker-compose.fault-demo.yml`: Nginx (load balancer) + 2× server containers + Postgres + Redis. Open app (frontend points at Nginx). **Kill one server container** (`docker stop ...`). Show app still works (Nginx routes to the other). ✅ Proves “system stays up when one instance fails.”

Both satisfy **“Evidence of Fault Tolerance”** for the rubric.
