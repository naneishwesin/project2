# Architecture Design (Discord-Style Real-Time Platform on AWS)

## System Diagram

**Drawn diagram:** Open [system-architecture.svg](./system-architecture.svg) in a browser to view (or embed in slides/docs).  
You can export it as PNG/PDF from the browser (Print → Save as PDF, or screenshot).

![System architecture](./system-architecture.svg)

## System Diagram (Mermaid) — for docs that render Mermaid

```mermaid
flowchart LR
  user((Users\nBrowsers))
  cf[CloudFront CDN\n(optional for demo)]
  s3[(S3 Bucket\navatars/uploads)]

  subgraph vpc[VPC (2 AZ)]
    subgraph pub[Public Subnets (AZ-A, AZ-B)]
      alb[Application Load Balancer\nHTTPS + WebSocket]
    end

    subgraph priv[Private Subnets (AZ-A, AZ-B)]
      ecs[ECS Service (Fargate or EC2)\nChat + WebRTC Signaling]
      asg[EC2 Auto Scaling Group\nLegacy REST service]
      rds[(RDS Postgres\nMulti-AZ in design)]
      redis[(ElastiCache Redis)]
    end
  end

  user -->|HTTPS/WSS| alb
  alb -->|/socket.io + /api| ecs
  alb -->|/legacy-api (optional)| asg
  ecs --> rds
  ecs --> redis
  asg --> rds
  asg --> redis
  user --> cf --> s3
```

## Traffic Flow (what happens)

- **Login/Auth**: Browser → ALB → ECS REST → RDS (users) → returns JWT.
- **Text chat**:
  - Browser opens **WebSocket** (Socket.IO) to ALB → ECS.
  - Send message → ECS writes to **RDS** (history) and pushes to channel room.
  - ECS also caches recent messages/presence in **Redis** for low latency.
- **Voice/Video**:
  - Browser uses **WebRTC** media peer-to-peer.
  - Only **signaling** (offer/answer/ICE) goes via WebSocket to ECS.
  - If ECS restarts, ongoing WebRTC can continue (P2P), which is a resilience point.

## Service Justification

- **VPC + 2 AZ + public/private subnets**: isolation + HA baseline.
- **ALB**: WebSocket supported, TLS termination, health checks, cross-AZ load balancing.
- **ECS**: containerized chat/signaling for fast deployments and horizontal scaling.
- **EC2 ASG**: satisfies hybrid compute requirement; demonstrates VM autoscaling + self-heal.
- **RDS Postgres**: durable transactional store for accounts + message history.
- **Redis (ElastiCache)**: presence/session/cache for low-latency paths and reduced DB load.
- **S3 (+ CloudFront)**: scalable static/media storage; **CloudFront CDN** for global distribution (Terraform: `cloudfront.tf`).
- **Secure management**: **SSM Session Manager** on EC2 (identity-aware, no Bastion/SSH); private instances reach internet via NAT.
- **CloudWatch**: **custom dashboards** (ALB, ECS, ASG, RDS metrics) and **threshold-based alarms** (unhealthy hosts, CPU, 5xx) for availability and performance (Terraform: `cloudwatch.tf`).

