# Demo Runbook (6–10 min video script)

Use this for your **Live System Demonstration Video**. You **design on AWS** (docs) and **demo locally with Docker** (no AWS required).

---

## Option A: Normal run (Docker + npm)

1. `docker compose up -d` (Postgres 5433, Redis 6379)
2. Apply schema (once):  
   `docker exec -i project2-postgres-1 psql -U postgres -d rtcp < apps/server/src/schema.sql`  
   (If you already had DB: run `migration-channel-type.sql` too.)
3. `npm run dev` (server :3000, web :3001)
4. Open **http://localhost:3001** in two browsers (or two devices).

---

## Option B: Fault-tolerance demo (kill one container)

Simulates **load balancer + multiple backends**. One backend dies → app still works.

### Setup (once)

1. Start load-balanced stack:
   ```bash
   docker compose -f docker-compose.fault-demo.yml up --build -d
   ```
2. Apply schema to the **fault-demo** Postgres (port 5434):
   ```bash
   PGPORT=5434 psql -h localhost -U postgres -d rtcp -f apps/server/src/schema.sql
   ```
   (If `psql` is not on host, run the same SQL via a one-off postgres container or GUI.)
3. Run **only the web app** (so frontend talks to Nginx, not the dev server):
   ```bash
   npm run dev:web
   ```
4. Before opening the app, set API base to the load balancer:
   - Open **http://localhost:3001**
   - In browser console: `window.__API_BASE__ = "http://localhost:8080";` then refresh.
   - Or serve a small HTML that sets `window.__API_BASE__ = "http://localhost:8080"` before loading the app.

### Recording: fault tolerance

1. Show app working (login, channel, send a message).
2. List backend containers:
   ```bash
   docker compose -f docker-compose.fault-demo.yml ps
   ```
3. **Stop one server** (e.g. `server1`):
   ```bash
   docker compose -f docker-compose.fault-demo.yml stop server1
   ```
4. In the browser: send another message or refresh. **App still works** (Nginx routes to `server2`).
5. Restart the stopped server:
   ```bash
   docker compose -f docker-compose.fault-demo.yml start server1
   ```
6. Say to camera: *“We simulated a backend failure; the load balancer kept traffic on the remaining instance, so the system stayed up.”*

---

## Recording order (for the video)

1. **Architecture diagram** (20s)  
   Show `docs/architecture.md` or `docs/system-architecture.svg`. Say: *“We designed this on AWS; we demo locally with Docker.”*

2. **Login + channel** (20s)  
   Register/Login (user A + user B). Create server + channel.

3. **Real-time chat** (40s)  
   Send messages A → B. Show they appear instantly.

4. **Message history** (20s)  
   Refresh; show history from DB.

5. **Voice / video** (30–60s)  
   Start voice or video call, share call ID, join from other browser, confirm audio/video.

6. **Fault tolerance** (40s)  
   - **Option A (simple):** Stop the Node server (Ctrl+C in the terminal). Show “disconnected”. Restart server. Show reconnection and that chat/history still work.  
   - **Option B (stronger):** Use `docker-compose.fault-demo.yml` and **stop one server container**; show app still works (see Option B above).

7. **Scaling / design** (20s)  
   Mention: *“In the design we have auto-scaling and multi-AZ; here we simulated failover by killing one backend.”*  
   Optional: show `docker compose -f docker-compose.fault-demo.yml up -d --scale server=2` (or the two services in the compose) as “multiple instances”.

---

## Checklist before recording

- [ ] Postgres + Redis up (main compose or fault-demo compose).
- [ ] Schema (and migration if needed) applied.
- [ ] App running (npm run dev, or fault-demo + dev:web with `__API_BASE__` set).
- [ ] Two browsers or devices ready.
- [ ] Diagram and docs open for screen-share.
