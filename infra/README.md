# Progression infrastructure (AWS CDK)

All cloud resources are defined in Java with the AWS CDK. Nothing is created by
hand in the console, so the environment can be recreated or torn down with one
command. See [ADR 0004](../docs/adr/0004-local-first-aws-later.md) and
[ADR 0005](../docs/adr/0005-cognito-authentication.md).

| Stack | What it creates | Status |
| --- | --- | --- |
| `Progression-Auth` | Cognito user pool (email/phone sign-in), Google identity provider, mobile app client, OAuth domain | Ready to deploy |
| `Progression-Data` | VPC (no NAT gateway), RDS PostgreSQL 18 (db.t4g.micro, encrypted, private, deletion-protected) | Ready to deploy |
| `Progression-Api` | API container on ECS Fargate (ARM64), internal load balancer, CloudFront (HTTPS) | Ready to deploy |

```
phone ──HTTPS──▶ CloudFront ──(VPC origin, private)──▶ internal ALB ──▶ Fargate task ──▶ RDS (isolated subnets)
                                                                          └──▶ Cognito keys, Open Food Facts, Expo push
```

The only way into the system from the internet is HTTPS through CloudFront: the
load balancer has no public address, the tasks accept traffic only from the load
balancer, and the database has no route to the internet at all.

## Commands

```bash
./gradlew test          # assertions on the synthesized CloudFormation
cdk synth               # print the CloudFormation template
cdk diff                # what a deploy would change
cdk deploy Progression-Auth
cdk destroy Progression-Auth
```

`cdk` runs the app via `./gradlew -q run` (see `cdk.json`). No Maven or global
Gradle install is needed.

---

## Deploying authentication

### 1. AWS credentials (one time)

Use an IAM user or IAM Identity Center user with administrator access,
**not the root account**:

```bash
aws configure            # paste the access key, secret, and region (e.g. us-east-1)
aws sts get-caller-identity   # confirms which account you're using
cdk bootstrap            # one-time per account/region: creates the CDK staging bucket
```

### 2. Deploy the user pool

```bash
cd infra
cdk deploy Progression-Auth
```

The outputs (also visible in the CloudFormation console) map to config like this:

| Output | Mobile `.env` | Backend environment |
| --- | --- | --- |
| `Region` | `EXPO_PUBLIC_COGNITO_REGION` | |
| `MobileClientId` | `EXPO_PUBLIC_COGNITO_CLIENT_ID` | `COGNITO_CLIENT_ID` |
| `OAuthDomain` | `EXPO_PUBLIC_COGNITO_DOMAIN` | |
| `IssuerUri` | | `COGNITO_ISSUER_URI` |

At this point **email sign-up works**. Cognito sends the verification emails
itself (limited to 50/day, which is plenty for development; switch to Amazon
SES for production volume).

To make the local API accept these real tokens too:

```bash
cd backend
COGNITO_ISSUER_URI=<IssuerUri> COGNITO_CLIENT_ID=<MobileClientId> ./gradlew bootRun
```

### 3. Google sign-in (optional)

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project, then:
   - **APIs & Services → OAuth consent screen**: External, app name "Progression",
     scopes `openid`, `email`, `profile`. Add yourself as a test user.
   - **Credentials → Create credentials → OAuth client ID → Web application**.
     Authorized redirect URI: `<OAuthDomain>/oauth2/idpresponse`
     (e.g. `https://progression-123456789012.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`).
2. Store the client **secret** in Secrets Manager (it never appears in code or templates):
   ```bash
   aws secretsmanager create-secret --name progression/google-oauth-client-secret \
     --secret-string '<client secret>'
   ```
3. Deploy with the client **id**, plus the Expo Go redirect URL for development.
   The app logs its exact redirect URL on startup (`[auth] Google redirect URI: ...`):
   ```bash
   cdk deploy Progression-Auth \
     -c googleClientId=<client id>.apps.googleusercontent.com \
     -c devCallbackUrls=exp://192.168.1.20:8081/--/auth
   ```
   To avoid repeating these flags, add them under `"context"` in `cdk.json`.
4. Set `EXPO_PUBLIC_GOOGLE_SIGN_IN=true` in `mobile/.env`.

> The Expo Go URL contains your Mac's LAN IP. If the IP changes, redeploy with the
> new value. Standalone builds use the fixed `progression://auth`, which is always registered.

### 4. Phone-number sign-up (SMS)

Cognito texts verification codes through **Amazon SNS**, and AWS restricts SMS
on new accounts:

- **SMS sandbox:** new accounts can only text verified numbers. Add your own
  phone under *Amazon SNS → Text messaging (SMS) → Sandbox destination phone numbers*.
- **US numbers need an origination identity:** register a toll-free number in
  *AWS End User Messaging SMS* (about $2/month plus per-message fees; approval
  can take a few days).
- To text anyone (not just verified numbers), request production access to leave the sandbox.

Until then, phone sign-up returns "couldn't send the verification code". Email
and Google work regardless.

## Deploying the API

Prerequisites: authentication is deployed (above), Docker is running (Colima),
and the CDK bootstrap has been done once per account/region (`cdk bootstrap`).

```bash
cd infra
cdk deploy Progression-Data       # VPC + database (~10 minutes the first time)
cdk deploy Progression-Api        # builds backend/Dockerfile for ARM64, pushes it, starts the service
```

The `Progression-Api` output **ApiUrl** (e.g. `https://d1234abcd.cloudfront.net`)
is the address the app needs. Set it for production builds:

```bash
cd mobile
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://d1234abcd.cloudfront.net
```

Redeploying after backend changes is the same `cdk deploy Progression-Api`:
CDK rebuilds the image, and ECS rolls it out with zero downtime (new task
healthy first, then the old one drains), rolling back automatically if the new
version fails its health checks.

Optional context:

| Context | Effect |
| --- | --- |
| `-c apiDomain=api.example.com -c apiCertificateArn=arn:aws:acm:us-east-1:…` | Serve the API on your own domain (certificate in us-east-1) |
| `-c apiTasks=2` | Run two API containers |

**Logs**: CloudWatch log group from the `LogGroupName` output. Logs are JSON,
so CloudWatch Logs Insights can filter by field, e.g.
`fields @timestamp, log.level, message | filter log.level = "ERROR"`.

## Costs

| Resource | Cost |
| --- | --- |
| Cognito (Essentials tier) | Free up to 10,000 monthly active users |
| Secrets Manager (Google secret) | ~$0.40/month |
| SMS (optional) | Toll-free number ~$2/month + ~$0.01 per message (US) |
| Fargate, 0.5 vCPU / 1 GB ARM64, 1 task | ~$14/month |
| Application Load Balancer | ~$17/month |
| RDS db.t4g.micro + 20 GB gp3 | ~$14/month (free for the first 12 months on a new account) |
| Public IPv4 address (the task) | ~$3.60/month |
| CloudFront, Secrets Manager, CloudWatch Logs, ECR | ~$1–2/month at small scale (CloudFront's free tier covers 10M requests) |
| **Total (API running)** | **~$35/month with the RDS free tier, ~$50/month after** |

Scale-to-zero isn't possible with this design (the load balancer and database
bill hourly), which is the trade-off for a conventional, production-shaped
setup. Pausing it costs nothing to set up again: see Teardown.

## Teardown

`cdk destroy Progression-Api` stops all API costs (about $35 of the total) and
can be redeployed any time. `Progression-Data` has deletion protection on the
database: to delete it, turn protection off in the RDS console, then
`cdk destroy Progression-Data` (a final snapshot is kept, which costs a little
per GB until you delete it).

`cdk destroy Progression-Auth` removes everything **except the user pool**,
which has `RemovalPolicy.RETAIN` so a mistaken destroy can't delete every
account. Delete it in the Cognito console if you really want it gone.
