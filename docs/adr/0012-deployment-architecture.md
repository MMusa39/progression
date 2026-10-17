# 0012: Deploy behind CloudFront with a VPC origin, without a NAT gateway

- **Status:** Accepted
- **Date:** 2026-10-17
- **Builds on:** [ADR 0004](0004-local-first-aws-later.md)

## Context

The API needs to run on AWS for the App Store release. The requirements:

- **HTTPS everywhere.** iOS blocks plain HTTP in release builds (App Transport
  Security), and tokens travel in headers.
- **Small attack surface.** Only the API should be reachable from the internet.
- **Low, predictable cost** for a personal project with few users, while still
  looking like a production setup: containers, managed database, rolling deploys.
- **No domain required** to launch; a custom domain should be easy to add later.

The usual reference design has a public ALB with an ACM certificate (which
needs a domain), tasks in private subnets, and a NAT gateway for their outbound
calls. The NAT gateway alone (~$32/month) would cost more than the API itself.

## Decision

```
phone ──HTTPS──▶ CloudFront ──(VPC origin)──▶ internal ALB ──▶ Fargate (public subnet, inbound from ALB only) ──▶ RDS (isolated subnet)
```

- **CloudFront terminates TLS** on its `*.cloudfront.net` certificate, so
  there's HTTPS from day one without a domain. Caching is disabled, and all
  viewer headers (including `Authorization`) are forwarded. A custom domain is
  two context values (`apiDomain`, `apiCertificateArn`).
- **CloudFront VPC origin to an internal ALB.** The load balancer has no public
  address and sits in isolated subnets. CloudFront reaches it through
  service-managed endpoints inside the VPC, so the ALB only needs to accept
  traffic from the VPC's own range.
- **Fargate tasks in public subnets with public IPs**, instead of private
  subnets with a NAT gateway. They need outbound internet for Cognito signing
  keys, Open Food Facts and Expo push. Their security group admits only the
  ALB, so a public IP doesn't make them reachable.
- **Database in isolated subnets** (no route to the internet in either
  direction), reachable only from the tasks' security group.
- **Graviton everywhere** (Fargate ARM64, db.t4g.micro), about 20% cheaper. The
  image builds natively on Apple-silicon Macs.
- **Two stacks for two lifecycles.** `Progression-Data` (VPC, RDS: deletion
  protection, snapshot on destroy) and `Progression-Api` (everything stateless).
  The API can be destroyed and recreated freely to pause costs.

## Consequences

- About $35/month while running (with the RDS free tier), roughly half the
  NAT-based design. See `infra/README.md` for the breakdown.
- Each task has a public IPv4 address (~$3.60/month each). It isn't reachable,
  but it shows up in an audit and should be explained.
- CloudFront adds a few milliseconds per request and has its own limits (for
  example, a 60-second origin timeout by default), which are fine for this API.
- Rate limiting is per instance (in the app). A global limit would use AWS WAF
  on the distribution, a few dollars a month, when there's traffic worth
  protecting.
