#!/bin/bash
# ================================
# Docker entrypoint for fnbox-backend
# ================================
# Fixes kubeconfig to use kind container name or host IP

set -e

echo "==> Configuring Kubernetes access..."

# Check if kubeconfig exists (mounted from host)
if [ -f /home/django/.kube/config ]; then
    echo "    Found kubeconfig at /home/django/.kube/config"

    # Copy the mounted (read-only) kubeconfig to a writable location
    cp /home/django/.kube/config /tmp/kubeconfig.tmp

    # Check if we're on the same Docker network as kind (preferred)
    # Try to find the kind control plane container
    KIND_CONTAINER=""
    for name in fnbox-cluster-control-plane kind-control-plane; do
        if getent hosts $name > /dev/null 2>&1; then
            KIND_CONTAINER=$name
            echo "    Detected kind container: ${KIND_CONTAINER}"
            break
        fi
    done

    if [ -n "$KIND_CONTAINER" ]; then
        # We're on the same network as kind - use container name (best option)
        echo "    Using kind container network (direct connection)"
        sed "s|https://127\.0\.0\.1:[0-9]*|https://${KIND_CONTAINER}:6443|g" /tmp/kubeconfig.tmp | \
        sed "s|https://localhost:[0-9]*|https://${KIND_CONTAINER}:6443|g" | \
        sed "s|https://[0-9.]*:[0-9]*|https://${KIND_CONTAINER}:6443|g" > /home/django/.kube/config.local
        echo "    ✓ Using direct connection to ${KIND_CONTAINER}:6443"
    elif [ -n "$HOST_IP" ]; then
        # Fall back to host IP
        echo "    Using host IP: ${HOST_IP}"
        sed "s|https://127\.0\.0\.1:|https://${HOST_IP}:|g" /tmp/kubeconfig.tmp | \
        sed "s|https://localhost:|https://${HOST_IP}:|g" > /home/django/.kube/config.local
        echo "    ✓ Using host IP connection"
    else
        # No modification possible
        echo "    ⚠ Warning: Cannot modify kubeconfig (no kind container or HOST_IP found)"
        cp /tmp/kubeconfig.tmp /home/django/.kube/config.local
    fi

    # Use the modified config
    export KUBECONFIG=/home/django/.kube/config.local

    # Show the server URL for debugging
    SERVER_URL=$(grep "server:" /home/django/.kube/config.local | head -1 | awk '{print $2}')
    echo "    Kubernetes API: ${SERVER_URL}"
else
    echo "    ⚠ Warning: No kubeconfig found at /home/django/.kube/config"
    echo "    Kubernetes operations will fail unless running in-cluster"
fi

echo "==> Starting application..."
echo ""

# Execute the original command (CMD from Dockerfile)
exec "$@"
