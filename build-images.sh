#!/bin/bash

# Configuration
REGISTRY="artifactory-jfrog.apps.ocp4.svc.prod.pl2cloud.de"
NAMESPACE="custom-shared-images/jneubert"
VERSION=$1
IMAGE_BASE="${REGISTRY}/${NAMESPACE}/plain-community-store"

# Build Platforms
PLATFORM="linux/amd64"

if [ -z "$1" ]; then
    echo "Error: Version argument is required."
    echo "Usage: ./build-images.sh [version]"
    exit 1
fi

echo "Building and pushing images for version ${VERSION} and latest..."

# 1. Build and push Root Image
echo "------------------------------------------------"
echo "Building Root Image..."
podman build --platform "$PLATFORM" -t "${IMAGE_BASE}:${VERSION}" -t "${IMAGE_BASE}:latest" .
echo "Pushing Root Image..."
podman push "${IMAGE_BASE}:${VERSION}"
podman push "${IMAGE_BASE}:latest"

# 2. Build and push Frontend Image
echo "------------------------------------------------"
echo "Building Frontend Image..."
cd services/frontend
podman build --platform "$PLATFORM" --file Dockerfile -t "${IMAGE_BASE}-frontend:${VERSION}" -t "${IMAGE_BASE}-frontend:latest" .
echo "Pushing Frontend Image..."
podman push "${IMAGE_BASE}-frontend:${VERSION}"
podman push "${IMAGE_BASE}-frontend:latest"
cd ../..

# 3. Build and push Backend Image
echo "------------------------------------------------"
echo "Building Backend Image..."
cd services/backend
podman build --platform "$PLATFORM" --file Dockerfile -t "${IMAGE_BASE}-backend:${VERSION}" -t "${IMAGE_BASE}-backend:latest" .
echo "Pushing Backend Image..."
podman push "${IMAGE_BASE}-backend:${VERSION}"
podman push "${IMAGE_BASE}-backend:latest"
cd ../..

echo "------------------------------------------------"
echo "All images built and pushed successfully!"
