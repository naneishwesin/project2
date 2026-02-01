# Demo Runbook (6–10 min video script)

## Setup
- Open **two browsers** (Chrome + Firefox) or **two devices** on same Wi‑Fi.
- Have CloudWatch dashboard open in another tab.

## Recording order (matches rubric)

1. **Architecture diagram** (20s)
   - Show `docs/architecture.md` diagram (or your exported image).

2. **Login + join channel** (20s)
   - Register/Login user A + user B.
   - Create server + channel.

3. **Real-time chat** (40s)
   - Send messages from A → see instantly on B.

4. **Message history** (20s)
   - Refresh B’s page → load history from DB.

5. **Voice call** (30–60s)
   - A clicks “Start Voice Call”, share callId to B.
   - B joins, confirm audio both ways.

6. **Video call** (30–60s)
   - Repeat with video (or start video call first).

7. **CloudWatch dashboard** (20s)
   - Show ALB target health + ECS/EC2 CPU.

8. **Fault tolerance demo** (40s)
   - Stop an **ECS task** OR terminate an **EC2 instance**.
   - Show: chat still works (ALB routes to healthy targets).
   - Mention: WebRTC media can continue P2P even if backend restarts.

9. **Auto-scaling evidence** (20–40s)
   - Show ASG “Activity history” scale out event and/or ECS desired tasks increased.
   - (Optional) show a short load test results screenshot.

