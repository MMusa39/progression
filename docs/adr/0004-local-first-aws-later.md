# 0004: Develop locally, deploy to AWS with CDK later

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
An always-on AWS deployment (ECS Fargate + RDS + load balancer) costs roughly
$30–60/month. Most early development doesn't need the cloud.

## Decision
- Develop against PostgreSQL in Docker and a `local` Spring profile.
- Define all infrastructure with the **AWS CDK in Java** from the start, so
  deployment is one command whenever it's wanted.
- Target architecture: ECS Fargate (containerized Spring Boot) behind an
  Application Load Balancer, RDS PostgreSQL in private subnets, Cognito for
  auth, Secrets Manager for database credentials, and CloudWatch for logs.

## Consequences
- No cloud spend during development.
- The environment can be deployed for a demo and destroyed afterwards (`cdk destroy`).
- Local and cloud configuration differ only through Spring profiles and environment variables.
