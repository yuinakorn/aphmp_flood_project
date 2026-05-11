---
name: push_docker_ghcr
description: Skill for building and pushing a Docker image to GitHub Container Registry (GHCR) using a custom push_ghcr.sh script.
---

# Push Docker Image to GHCR

This skill explains how to build and push a Docker image for a Node.js/Next.js project to the GitHub Container Registry (GHCR) (or any custom registry) using the provided `push_ghcr.sh` script.

## Overview
The `push_ghcr.sh` script automates the process of building the Docker image for multiple platforms (defaulting to `linux/amd64`) and pushing it to your specified registry.

It handles:
1. Extracting the version from `package.json` (if available).
2. Extracting the current Git commit SHA.
3. Reading `NEXT_PUBLIC_*` (or other prefix defined in the script) environment variables from `.env`, `.env.production`, or `.env.local` to pass them as build arguments.
4. Tagging the image with `latest`, the current version, and the Git SHA (`sha-<short_sha>`).
5. Pushing the image to the specified target image repository.

## Usage

To use this script, simply execute it in the terminal at the root of the project:

```bash
./push_ghcr.sh
```

### Environment Variables
You can override default behaviors by passing environment variables before running the script:

- `IMAGE`: The target image repository (e.g., `ghcr.io/<your-username>/<your-project>`)
- `PLATFORM`: The target platform (default: `linux/amd64`)
- `VERSION`: The version tag (default: extracted from `package.json` or `latest`)
- `SHA`: The commit hash for the tag (default: short hash from `git log`)
- `ENV_FILE`: The specific env file to use (default: `.env` with fallbacks to `.env.production` and `.env.local`)

Example:
```bash
IMAGE=ghcr.io/my-username/my-awesome-app PLATFORM=linux/arm64 ./push_ghcr.sh
```

## Prerequisites
Before running the script, ensure that:
1. Docker is installed and running.
2. Docker Buildx is available (Docker version >= 19.03).
3. You are authenticated with your target container registry (e.g., `docker login ghcr.io`).
4. The `push_ghcr.sh` script has execute permissions (`chmod +x push_ghcr.sh`).

## Dockerfile & docker-compose.yml Integration

To make your project fully compatible with `push_ghcr.sh`, you need to set up your `Dockerfile` and `docker-compose.yml` correctly.

### Dockerfile
Since the script automatically extracts `NEXT_PUBLIC_*` environment variables and passes them as `--build-arg`, your `Dockerfile` must declare them using `ARG` and set them as `ENV` before the Next.js build step (`npm run build` or `yarn build`). The script also provides `GIT_SHA` and `BUILD_TIME`.

Example snippet for `Dockerfile`:
```dockerfile
# ... (dependencies and setup)

# Declare build arguments provided by push_ghcr.sh
ARG GIT_SHA
ARG BUILD_TIME
ARG NEXT_PUBLIC_API_URL
# Add other NEXT_PUBLIC_* variables here as needed

# Expose them as environment variables during the build process
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Run the build
RUN npm run build

# ... (rest of the Dockerfile)
```

### docker-compose.yml
When running the image via Docker Compose (for example, in production or for testing the built image locally), make sure to map the `.env` files or required environment variables if there are server-side secrets (since `NEXT_PUBLIC_*` are already baked into the image during the build).

Example `docker-compose.yml`:
```yaml
version: '3.8'

services:
  web:
    image: ghcr.io/<your-username>/<your-project>:latest
    ports:
      - "3000:3000"
    # Provide server-side runtime environment variables
    env_file:
      - .env.production
    restart: unless-stopped
```

## Note for Agents
If the user asks to build the Docker image, deploy, or push the container, use the `run_command` tool to execute `./push_ghcr.sh`.
Make sure to check if they want to target a specific platform, use a specific env file, or define a specific `IMAGE` repository first.
When creating or modifying the `Dockerfile`, ensure `ARG` and `ENV` instructions are present for the necessary `NEXT_PUBLIC_*` variables so the frontend can access them at build time.
