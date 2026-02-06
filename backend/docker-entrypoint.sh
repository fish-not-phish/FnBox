#!/bin/bash
# ================================
# Docker entrypoint for fnbox-backend
# ================================
# Configures Kubernetes, runs migrations, and starts the application

set -e

echo "========================================="
echo "FnBox Backend Startup"
echo "========================================="
echo ""

# ================================
# Kubernetes Configuration
# ================================
echo "==> Configuring Kubernetes access..."

if [ -f /home/django/.kube/config ]; then
    echo "    Found kubeconfig at /home/django/.kube/config"

    # Copy the mounted (read-only) kubeconfig to a writable location
    cp /home/django/.kube/config /tmp/kubeconfig.tmp

    # Check if we're on the same Docker network as kind (preferred)
    KIND_CONTAINER=""
    for name in fnbox-cluster-control-plane kind-control-plane; do
        if getent hosts $name > /dev/null 2>&1; then
            KIND_CONTAINER=$name
            echo "    Detected kind container: ${KIND_CONTAINER}"
            break
        fi
    done

    if [ -n "$KIND_CONTAINER" ]; then
        echo "    Using kind container network (direct connection)"
        sed "s|https://127\.0\.0\.1:[0-9]*|https://${KIND_CONTAINER}:6443|g" /tmp/kubeconfig.tmp | \
        sed "s|https://localhost:[0-9]*|https://${KIND_CONTAINER}:6443|g" | \
        sed "s|https://[0-9.]*:[0-9]*|https://${KIND_CONTAINER}:6443|g" > /home/django/.kube/config.local
        echo "    ✓ Using direct connection to ${KIND_CONTAINER}:6443"
    elif [ -n "$HOST_IP" ]; then
        echo "    Using host IP: ${HOST_IP}"
        sed "s|https://127\.0\.0\.1:|https://${HOST_IP}:|g" /tmp/kubeconfig.tmp | \
        sed "s|https://localhost:|https://${HOST_IP}:|g" > /home/django/.kube/config.local
        echo "    ✓ Using host IP connection"
    else
        echo "    ⚠ Warning: Cannot modify kubeconfig (no kind container or HOST_IP found)"
        cp /tmp/kubeconfig.tmp /home/django/.kube/config.local
    fi

    export KUBECONFIG=/home/django/.kube/config.local
    SERVER_URL=$(grep "server:" /home/django/.kube/config.local | head -1 | awk '{print $2}')
    echo "    Kubernetes API: ${SERVER_URL}"
else
    echo "    ⚠ Warning: No kubeconfig found at /home/django/.kube/config"
fi

echo ""

# ================================
# Database Migrations
# ================================
echo "==> Creating migrations for custom apps..."
python manage.py makemigrations --noinput || {
    echo "ERROR: makemigrations failed"
    exit 1
}

echo ""
echo "==> Running database migrations..."
python manage.py migrate --noinput || {
    echo "ERROR: Database migrations failed"
    exit 1
}

echo ""
echo "==> Updating site domain..."
python manage.py update_site_domain || {
    echo "ERROR: update_site_domain failed"
    exit 1
}

echo ""
echo "==> Collecting static files..."
python manage.py collectstatic --noinput || {
    echo "WARNING: collectstatic failed, continuing..."
}

echo ""
echo "========================================="
echo "Starting supervisord..."
echo "========================================="

# Start supervisord
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
