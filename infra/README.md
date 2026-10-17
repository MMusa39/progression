# Progression infrastructure (AWS CDK)

All cloud resources are defined in Java with the AWS CDK. Nothing is created by
hand in the console, so the environment can be recreated or torn down with one
command. See [ADR 0004](../docs/adr/0004-local-first-aws-later.md) and
[ADR 0005](../docs/adr/0005-cognito-authentication.md).

| Stack | What it creates | Status |
| --- | --- | --- |
| `Progression-Auth` | Cognito user pool (email/phone sign-in), Google identity provider, mobile app client, OAuth domain | Ready to deploy |
| `Progression-Network` / `-Database` / `-Service` | VPC, RDS PostgreSQL, ECS Fargate API behind a load balancer | Phase 7 |

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

## Costs

| Resource | Cost |
| --- | --- |
| Cognito (Essentials tier) | Free up to 10,000 monthly active users |
| Secrets Manager (Google secret) | ~$0.40/month |
| SMS (optional) | Toll-free number ~$2/month + ~$0.01 per message (US) |

## Teardown

`cdk destroy Progression-Auth` removes everything **except the user pool**,
which has `RemovalPolicy.RETAIN` so a mistaken destroy can't delete every
account. Delete it in the Cognito console if you really want it gone.
