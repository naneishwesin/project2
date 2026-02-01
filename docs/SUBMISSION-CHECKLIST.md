# Submission Checklist — Due 2 Feb 2026

You use **`apps/`** and **`docs/`** only. **`infra/`** is not used (optional reference). **Proposal: done** (as submitted).

---

## ✅ What you have (done)

### What you actually use

| Item | Where | Status |
|------|--------|--------|
| **Backend** | `apps/server` | ✅ Express, Socket.IO, WebRTC signaling, Postgres, Redis |
| **Frontend** | `apps/web` | ✅ Discord-style UI, text/voice channels, chat, voice/video |
| **Local run** | `docker-compose` + `npm run dev` | ✅ Postgres (5433), Redis, server (3000), web (3001) |
| **Design doc** | `docs/` | ✅ architecture.md, system-architecture.svg, cost-estimate.md |
| **Demo script** | `docs/demo-runbook.md` | ✅ For your video |

### Deliverable 1 — Architectural Design Document

| Item | Status | File |
|------|--------|------|
| System diagram | ✅ | `docs/architecture.md`, `docs/system-architecture.svg` |
| Service justification | ✅ | `docs/architecture.md` (Service Justification) |
| Cost estimation | ✅ | `docs/cost-estimate.md` |

The **design document** describes the target AWS architecture (VPC, 2 AZ, subnets, ALB, ECS, EC2 ASG, RDS, Redis, S3, CloudWatch, security, scaling). You are not deploying it; you are **documenting** it and running the **prototype** locally.

### Prototype (for Deliverable 2)

| Item | Status |
|------|--------|
| Real-time chat (WebSockets) | ✅ |
| Message persistence (Postgres) | ✅ |
| Caching / presence (Redis) | ✅ |
| Text channels + voice channels | ✅ |
| Voice/video (WebRTC + signaling) | ✅ |
| Discord-style UI | ✅ |

---

## ⏳ What you still need to do (before 2 Feb 2026)

### 1. Deliverable 2 — Live System Demonstration Video

- [ ] **Record** a 6–10 minute walkthrough.
- [ ] **Show** the prototype: login, servers/channels, chat, voice/video (all from **apps/** running locally).
- [ ] **Fault tolerance:** e.g. stop the server process, restart it, show the app reconnects; or show WebRTC surviving a refresh. (You are not using AWS, so “stop a server” = stop your local Node server and show recovery.)
- [ ] Use **`docs/demo-runbook.md`** as your script.

### 2. Deliverable 3 — Final Presentation

- [ ] **Create** a ~15-minute presentation (slides).
- [ ] **Cover:** architecture (from docs), biggest technical challenge, how high availability would be achieved (from your design).
- [ ] **Deliver** the presentation as required.

---

## Rubric (100 marks) — with apps/ + docs/ only

| Category | Marks | How you meet it |
|----------|-------|------------------|
| **Proposal** | 10 | ✅ Done |
| **Architectural Soundness** | 30 | ✅ **Design doc** (docs/): networking, subnets, HA, security (VPC, ALB, ECS, RDS, etc.). You describe the architecture; you don’t run infra/. |
| **System Functionality** | 20 | ✅ **Prototype** (apps/): app works locally, state in Postgres + Redis, correct behavior. |
| **Scalability & Resilience** | 25 | ✅ **Design doc** describes auto-scaling and failover. **Video:** show app recovery (e.g. restart server, reconnect) or explain scaling/failover from the design. |
| **Documentation & Presentation** | 15 | ✅ Design doc in docs/; **you** create and give the presentation. |

---

## Summary

- **You use:** `apps/` (backend + frontend) and `docs/` (architecture, cost, diagram, demo script). Run with Docker + `npm run dev`.
- **You do not use:** `infra/` (Terraform). It stays in the repo as optional reference only.
- **Still to do:** (1) Record the demo video (prototype + fault-tolerance), (2) Create and give the 15-min presentation.

Once the video and presentation are done, you’re complete for the 2 Feb 2026 due date.
