# Deploy to AWS (Terraform — matches aws-build-steps)

This Terraform stack implements **docs/aws-build-steps.md**: VPC (2 AZ), public/private subnets, security groups, ALB, ECS (chat + signaling), EC2 ASG (legacy /health), RDS Postgres (**Multi-AZ** by default), ElastiCache Redis, S3, **CloudFront CDN**, **CloudWatch dashboard + alarms**, ECR.

## Prerequisites

- **AWS CLI** configured (`aws configure`) with credentials that can create VPC, ECS, RDS, etc.
- **Terraform** >= 1.0 (`brew install terraform` or [terraform.io](https://www.terraform.io/downloads))
- **Docker** (to build and push the server image to ECR)

## 1. Configure variables

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set db_password (and optionally jwt_secret, web_origin, aws_region)
```

## 2. Initialize and plan

```bash
terraform init
terraform plan
```

## 3. Apply (create all resources)

```bash
terraform apply
```

Type `yes` when prompted. This creates: VPC, subnets, NAT, SGs, ALB, target groups, ECR repo, RDS, ElastiCache, S3, ECS cluster + task def + service, EC2 launch template + ASG. **Cost:** ~$70–95/month (see docs/cost-estimate.md). Use Free Tier where possible.

## 4. Build and push the server image

After `terraform apply`, push your app image to ECR so ECS can run it:

```bash
# From project root (not infra/)
AWS_REGION=$(terraform -chdir=infra output -raw region)
ECR_URI=$(terraform -chdir=infra output -raw ecr_repository_url)

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$(echo $ECR_URI | cut -d/ -f1)"
docker build -t rtcp-server ./apps/server
docker tag rtcp-server:latest "$ECR_URI:latest"
docker push "$ECR_URI:latest"
```

## 5. Run schema on RDS (once)

Connect from a machine that can reach RDS (e.g. EC2 via SSM, or temporarily allow your IP in SG-DB for one-off run). Or use **Bastion/SSM port forwarding**:

```bash
# Get RDS endpoint
terraform -chdir=infra output rds_endpoint

# Option A: If you have psql and network access to RDS (e.g. from EC2 via SSM)
# PGHOST=$(terraform -chdir=infra output -raw rds_endpoint)
# PGPASSWORD='...' psql -h $PGHOST -U postgres -d rtcp -f apps/server/src/schema.sql

# Option B: Run schema from an ECS exec session or a one-off task (advanced)
```

For a quick test, you can temporarily add your IP to **SG-DB** inbound, run `psql` or a GUI client from your laptop, then remove the rule.

## 6. Open the app

```bash
terraform -chdir=infra output alb_url
```

Open that URL in a browser. The ALB forwards `/`, `/api/*`, `/socket.io/*`, `/health` to ECS. Set your frontend’s `API_BASE` to this ALB URL (and `WEB_ORIGIN` in ECS to your frontend origin for CORS).

## 7. Update ECS after code changes

Rebuild and push the image, then force a new deployment:

```bash
docker build -t rtcp-server ./apps/server
docker tag rtcp-server:latest "$ECR_URI:latest"
docker push "$ECR_URI:latest"
aws ecs update-service --cluster rtcp-cluster --service rtcp-server --force-new-deployment --region "$AWS_REGION"
```

## Destroy (remove all resources)

```bash
cd infra
terraform destroy
```

Type `yes` when prompted. This deletes RDS, Redis, ECS, ALB, VPC, etc.

## What this creates (aligned with aws-build-steps)

| Phase | Resource |
|-------|----------|
| 2 | VPC, 2 AZ, public subnets (ALB), private subnets (ECS, EC2, RDS, Redis), IGW, NAT, route tables, SG-ALB, SG-APP, SG-DB, SG-REDIS |
| 3 | ALB (HTTP :80), TG-ECS, TG-EC2, listener rules (/api, /socket.io, /health, / → ECS; /legacy → EC2) |
| 4A | EC2 Launch Template (SSM, /health Python server), ASG (min 1, max 2), CPU scaling policy |
| 4B | ECS cluster, task definition (Fargate, env from RDS/Redis), service, CPU scaling policy, ECR repo |
| 5 | RDS Postgres (db.t3.micro, **Multi-AZ**), ElastiCache Redis (cache.t3.micro), S3 bucket, **CloudFront** distribution (CDN) |
| 9 | **CloudWatch dashboard** (ALB, ECS, ASG, RDS), **alarms** (unhealthy hosts, CPU, 5xx) |
| — | CloudWatch log group for ECS |

After apply: `terraform -chdir=infra output cloudwatch_dashboard_url` for the dashboard; `terraform -chdir=infra output cloudfront_url` for S3 CDN. HTTPS (ACM + listener 443) can be added in Terraform or via the console.
