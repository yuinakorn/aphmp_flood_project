#!/bin/bash
set -e

# Default configurations
IMAGE=${IMAGE:-"ghcr.io/yuinakorn/aphmp_flood_project"}
PLATFORM=${PLATFORM:-"linux/amd64"}

echo "=== Building and Pushing Docker Image to GHCR ==="

# 1. Extract version from package.json
if [ -f "package.json" ]; then
  VERSION=${VERSION:-$(grep -o '"version": "[^"]*' package.json | grep -o '[^"]*$' | head -1)}
fi
VERSION=${VERSION:-"latest"}

# 2. Extract current Git commit SHA
SHA=${SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}

# 3. Read NEXT_PUBLIC_* env variables
ENV_FILE=${ENV_FILE:-""}
if [ -z "$ENV_FILE" ]; then
  if [ -f ".env" ]; then ENV_FILE=".env";
  elif [ -f ".env.production" ]; then ENV_FILE=".env.production";
  elif [ -f ".env.local" ]; then ENV_FILE=".env.local";
  fi
fi

BUILD_ARGS=""
if [ -f "$ENV_FILE" ]; then
  echo "Using environment file: $ENV_FILE"
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    if [[ $line =~ ^#.* ]] || [[ -z $line ]]; then
      continue
    fi
    # Match NEXT_PUBLIC_ variables
    if [[ $line == NEXT_PUBLIC_* ]]; then
      # Extract name and value safely
      var_name=$(echo "$line" | cut -d '=' -f 1)
      var_value=$(echo "$line" | cut -d '=' -f 2-)
      # Remove surrounding quotes if they exist
      var_value=$(echo "$var_value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
      BUILD_ARGS="$BUILD_ARGS --build-arg $var_name=\"$var_value\""
    fi
  done < "$ENV_FILE"
else
  echo "No environment file found. Skipping NEXT_PUBLIC_* args."
fi

# Include standard build args
BUILD_TIME=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
BUILD_ARGS="$BUILD_ARGS --build-arg GIT_SHA=$SHA --build-arg BUILD_TIME=$BUILD_TIME"

# 4. Tagging strategy
TAGS="-t $IMAGE:latest -t $IMAGE:$VERSION -t $IMAGE:sha-$SHA"

echo "Image Repository : $IMAGE"
echo "Target Platform  : $PLATFORM"
echo "Version Tag      : $VERSION"
echo "Git SHA          : $SHA"
echo "Build Time       : $BUILD_TIME"
echo "================================================="

# 5. Build and Push using buildx
CMD="docker buildx build --platform $PLATFORM $TAGS $BUILD_ARGS --push ."

echo "Executing: $CMD"
eval $CMD

echo "================================================="
echo "✅ Successfully built and pushed $IMAGE"
