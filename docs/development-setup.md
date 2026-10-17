# Development setup

How to install the toolchain on macOS (Apple Silicon) and run Progression
locally.

## 1. Toolchain

| Tool | Why it's needed | Install |
| --- | --- | --- |
| Homebrew | macOS package manager used to install everything else | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| JDK 25 (LTS) | Compiles and runs the Spring Boot backend and the CDK app | `brew install openjdk@25` |
| Node.js (LTS) | Runs the Expo tooling and the AWS CDK CLI | `brew install node@24` |
| Colima + Docker CLI | Lightweight container runtime for local PostgreSQL and Testcontainers | `brew install colima docker docker-compose` |
| AWS CLI v2 | Authenticates with AWS for deployment | `brew install awscli` |
| AWS CDK CLI | Synthesizes and deploys the infrastructure | `npm install -g aws-cdk` (with `NPM_CONFIG_PREFIX=~/.npm-global`, no sudo) |
| Expo Go (iPhone) | Runs the development build of the app on your phone | Install from the App Store |

Gradle does **not** need to be installed globally. The backend ships with the
Gradle Wrapper (`./gradlew`), which downloads the exact Gradle version the
project expects.

### Shell configuration

Homebrew's JDK is "keg-only" (not linked into your PATH, to avoid clashing with
other Java installs). Add this to `~/.zprofile`:

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:/opt/homebrew/opt/node@24/bin:$PATH"
# npm global packages in your home directory (no sudo)
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

### Docker runtime (Colima)

```bash
colima start --cpu 4 --memory 6     # starts a small Linux VM that runs containers
docker ps                           # should print an empty table
```

Tell the Docker CLI where Compose is installed, in `~/.docker/config.json`:

```json
{ "cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"] }
```

Testcontainers needs to know where Colima's Docker socket is. Add to `~/.zprofile`:

```bash
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
export TESTCONTAINERS_RYUK_DISABLED=true
```

## 2. Running locally

### Backend

```bash
colima start                 # if Docker isn't already running
cd backend && ./gradlew bootRun
```

API on http://localhost:8080, Swagger UI at http://localhost:8080/swagger-ui.html.
Full details in [backend/README.md](../backend/README.md).

To fill the Progress charts with realistic data (16 weeks of a push/pull/legs
program for the development account):

```bash
python3 backend/scripts/seed_dev_data.py          # --subject, --weeks, --seed are optional
```

### Mobile

```bash
cd mobile
npm install
npx expo start      # scan the QR code with your iPhone camera (Expo Go installed)
```

Tap **Use development account** to sign in against the local API.
`npx expo start --web` also runs the app in a desktop browser, which is handy
for quick visual checks (the local API allows CORS from localhost). To enable
real sign-up, deploy Cognito ([infra/README.md](../infra/README.md)) and fill
in `mobile/.env`. Full details in [mobile/README.md](../mobile/README.md).

### Infrastructure

```bash
cd infra
./gradlew test      # template assertions
cdk synth           # generate CloudFormation (no AWS account needed with CDK_DEFAULT_* set)
```
