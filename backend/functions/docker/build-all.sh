#!/bin/bash
# Build all function runtime Docker images

set -e

REGISTRY="${REGISTRY:-}"  # Set to your registry, e.g., "myregistry.io/fnbox"
TAG="${TAG:-latest}"

echo "Building function runtime images..."
echo "Registry: ${REGISTRY:-local}"
echo "Tag: ${TAG}"
echo

# Function to build image
build_image() {
    local runtime=$1
    local version=$2
    local build_arg=$3
    local build_arg_name=$4

    local image_name="fnbox-${runtime}:${version}"
    if [ -n "$REGISTRY" ]; then
        image_name="${REGISTRY}/${image_name}"
    fi

    echo "Building ${image_name}..."

    if [ -n "$build_arg" ]; then
        docker build \
            --build-arg ${build_arg_name}=${build_arg} \
            -t "${image_name}" \
            -f "${runtime}/Dockerfile" \
            .
    else
        docker build \
            -t "${image_name}" \
            -f "${runtime}/Dockerfile" \
            .
    fi

    echo "✓ Built ${image_name}"
    echo
}

# Python versions
for version in 3.9 3.10 3.11 3.12 3.13 3.14; do
    build_image "python" "$version" "$version" "PYTHON_VERSION"
done

# Node.js versions
for version in 20 24 25; do
    build_image "nodejs" "$version" "$version" "NODE_VERSION"
done

# Ruby
build_image "ruby" "3.4" "" ""

# Java
build_image "java" "27" "" ""

# .NET versions
for version in 8 9 10; do
    build_image "dotnet" "$version" "${version}.0" "DOTNET_VERSION"
done

# Bash
build_image "bash" "5" "" ""

# Go
build_image "go" "1.25" "" ""

echo
echo "All images built successfully!"
echo
echo "To push to registry, run:"
echo "  docker push ${REGISTRY:-}fnbox-*"
