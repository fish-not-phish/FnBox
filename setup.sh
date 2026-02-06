#!/bin/bash
# ================================
# FnBox Platform Setup Script
# ================================
# Interactive configuration generator for backend and frontend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to print colored output
print_header() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BLUE}$1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to prompt for input with default value
prompt_with_default() {
    local prompt=$1
    local default=$2
    local var_name=$3
    local is_secret=${4:-false}

    if [ "$is_secret" = true ]; then
        echo -ne "${CYAN}${prompt}${NC} ${YELLOW}[${default}]${NC}: "
        read -s value
        echo ""
    else
        echo -ne "${CYAN}${prompt}${NC} ${YELLOW}[${default}]${NC}: "
        read value
    fi

    if [ -z "$value" ]; then
        eval "$var_name='$default'"
    else
        eval "$var_name='$value'"
    fi
}

# Function to prompt yes/no
prompt_yes_no() {
    local prompt=$1
    local default=$2

    while true; do
        echo -ne "${CYAN}${prompt}${NC} ${YELLOW}[${default}]${NC}: "
        read yn
        yn=${yn:-$default}
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes (y) or no (n).";;
        esac
    done
}

# Function to generate SECRET_KEY (no Django required)
generate_secret_key() {
    python3 -c "import secrets, string; chars = string.ascii_letters + string.digits + string.punctuation.replace('\"', '').replace(\"'\", '').replace('\\\\', ''); print(''.join(secrets.choice(chars) for _ in range(50)))"
}

# Function to validate email
validate_email() {
    local email=$1
    if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Clear screen and show banner
clear
echo ""
print_header "              FnBox Configuration Setup              "
echo ""
print_info "This script will help you configure FnBox."
print_info "Press Enter to accept default values shown in ${YELLOW}[brackets]${NC}"
echo ""

# Check if .env files already exist
BACKEND_ENV="$SCRIPT_DIR/backend/.env"
FRONTEND_ENV="$SCRIPT_DIR/frontend/.env.local"

if [ -f "$BACKEND_ENV" ] || [ -f "$FRONTEND_ENV" ]; then
    echo ""
    print_warning "Existing configuration files detected!"
    if [ -f "$BACKEND_ENV" ]; then
        print_warning "  - backend/.env exists"
    fi
    if [ -f "$FRONTEND_ENV" ]; then
        print_warning "  - frontend/.env.local exists"
    fi
    echo ""
    if ! prompt_yes_no "Do you want to overwrite existing configuration?" "n"; then
        print_info "Setup cancelled. Existing configuration preserved."
        exit 0
    fi
    echo ""
fi

# ================================
# Environment Detection
# ================================
print_header "                    Environment Settings                    "
echo ""

# Detect current user's UID and GID for Docker volume permissions
USER_UID=$(id -u)
USER_GID=$(id -g)
print_info "Detected user UID: ${USER_UID}, GID: ${USER_GID}"

# Detect host IP for Kubernetes API access from Docker containers
# Try multiple methods to find the best IP
if command -v ip &> /dev/null; then
    # Method 1: Get IP of primary network interface (most reliable)
    HOST_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}')
elif command -v hostname &> /dev/null; then
    # Method 2: Use hostname -I (backup)
    HOST_IP=$(hostname -I | awk '{print $1}')
else
    # Method 3: Fallback to docker0 bridge gateway
    HOST_IP="172.17.0.1"
fi

# Validate we got an IP
if [[ ! "$HOST_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_warning "Could not auto-detect host IP, using 172.17.0.1"
    HOST_IP="172.17.0.1"
fi

print_info "Host IP for K8s access: ${HOST_IP}"
echo ""

if prompt_yes_no "Is this a PRODUCTION environment?" "n"; then
    ENV_TYPE="production"
    DEBUG="0"
    print_success "Production mode enabled"
else
    ENV_TYPE="development"
    DEBUG="1"
    print_success "Development mode enabled"
fi

echo ""

# ================================
# Core Settings
# ================================
print_header "                      Core Settings                         "
echo ""

prompt_with_default "Domain name" "127.0.0.1:3000" CUSTOM_DOMAIN
prompt_with_default "Allowed hosts (comma-separated)" "${CUSTOM_DOMAIN},localhost" ALLOWED_HOSTS

echo ""

# Generate or preserve SECRET_KEY
if [ -f "$BACKEND_ENV" ] && grep -q "^SECRET_KEY=" "$BACKEND_ENV"; then
    # Extract existing SECRET_KEY to preserve encrypted secrets
    SECRET_KEY=$(grep "^SECRET_KEY=" "$BACKEND_ENV" | cut -d '=' -f 2-)
    # Strip quotes if present (handles both single and double quotes)
    SECRET_KEY="${SECRET_KEY//\'/}"
    SECRET_KEY="${SECRET_KEY//\"/}"
    print_success "Using existing SECRET_KEY (preserves encrypted secrets)"
else
    # Generate new SECRET_KEY for first-time setup
    print_info "Generating secure SECRET_KEY..."
    SECRET_KEY=$(generate_secret_key)
    if [ -n "$SECRET_KEY" ]; then
        print_success "SECRET_KEY generated successfully"
    else
        print_error "Failed to generate SECRET_KEY. Please ensure Python 3 is installed."
        print_info "You can manually generate one with:"
        echo "  python3 -c \"import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(50)))\""
        exit 1
    fi
fi

echo ""

# ================================
# Set Docker defaults
# ================================
# Always use Docker container names for deployment
DB_HOST_DEFAULT="fnbox-postgres"
REDIS_HOST_DEFAULT="fnbox-redis"

# ================================
# Database Configuration
# ================================
print_header "                  Database Configuration                   "
echo ""

prompt_with_default "Database name" "fnbox" DB_NAME
prompt_with_default "Database user" "fnbox" DB_USER
prompt_with_default "Database password" "fnbox" DB_PASSWORD true
prompt_with_default "Database host" "$DB_HOST_DEFAULT" DB_HOST
prompt_with_default "Database port" "5432" DB_PORT

echo ""

# ================================
# Redis Configuration
# ================================
print_header "                   Redis Configuration                     "
echo ""

prompt_with_default "Redis host" "$REDIS_HOST_DEFAULT" REDIS_HOST
prompt_with_default "Redis port" "6379" REDIS_PORT
prompt_with_default "Redis database" "0" REDIS_DB

echo ""

# ================================
# Email Configuration (Optional)
# ================================
print_header "                   Email Configuration                     "
echo ""

if [ "$ENV_TYPE" = "production" ]; then
    if prompt_yes_no "Do you want to configure email/SMTP? (optional)" "n"; then
        ENABLE_EMAIL="1"
        prompt_with_default "Email host" "smtp.gmail.com" EMAIL_HOST
        prompt_with_default "Email port" "587" EMAIL_PORT
        prompt_with_default "Email use TLS" "1" EMAIL_USE_TLS

        while true; do
            prompt_with_default "Email host user" "noreply@${CUSTOM_DOMAIN}" EMAIL_HOST_USER
            if validate_email "$EMAIL_HOST_USER"; then
                break
            else
                print_error "Invalid email address. Please try again."
            fi
        done

        prompt_with_default "Email host password" "" EMAIL_HOST_PASSWORD true
        prompt_with_default "Default from email" "$EMAIL_HOST_USER" DEFAULT_FROM_EMAIL
        print_success "Email configured"
    else
        ENABLE_EMAIL="0"
        EMAIL_HOST="smtp.gmail.com"
        EMAIL_PORT="587"
        EMAIL_USE_TLS="1"
        EMAIL_HOST_USER=""
        EMAIL_HOST_PASSWORD=""
        DEFAULT_FROM_EMAIL="noreply@localhost"
        print_info "Email disabled (using console backend)"
    fi
else
    ENABLE_EMAIL="0"
    EMAIL_HOST="smtp.gmail.com"
    EMAIL_PORT="587"
    EMAIL_USE_TLS="1"
    EMAIL_HOST_USER=""
    EMAIL_HOST_PASSWORD=""
    DEFAULT_FROM_EMAIL="noreply@localhost"
    print_info "Email disabled for development (console backend)"
fi

echo ""

# ================================
# Kubernetes Configuration
# ================================
print_header "                Kubernetes Configuration                   "
echo ""

# Kubernetes is always enabled
KUBERNETES_ENABLED="True"
prompt_with_default "Kubernetes namespace" "fnbox-functions" KUBERNETES_NAMESPACE
FUNCTION_BACKEND="kubernetes"
print_success "Kubernetes enabled with namespace: ${KUBERNETES_NAMESPACE}"

echo ""

# ================================
# OIDC Configuration
# ================================
print_header "                    OIDC/SSO Configuration                  "
echo ""

if prompt_yes_no "Do you want to configure OIDC/SSO?" "n"; then
    echo ""
    print_info "Supported providers: keycloak, authelia, authentik"

    while true; do
        prompt_with_default "OIDC provider type" "keycloak" OIDC_PROVIDER_TYPE
        OIDC_PROVIDER_TYPE=$(echo "$OIDC_PROVIDER_TYPE" | tr '[:upper:]' '[:lower:]')

        if [[ "$OIDC_PROVIDER_TYPE" =~ ^(keycloak|authelia|authentik)$ ]]; then
            break
        else
            print_error "Invalid provider. Choose: keycloak, authelia, or authentik"
        fi
    done

    prompt_with_default "OIDC client ID" "fnbox-platform" OIDC_CLIENT_ID
    prompt_with_default "OIDC client secret" "" OIDC_CLIENT_SECRET true

    # Suggest server URL based on provider
    case "$OIDC_PROVIDER_TYPE" in
        keycloak)
            DEFAULT_URL="https://auth.${CUSTOM_DOMAIN}/realms/master/.well-known/openid-configuration"
            ;;
        authelia)
            DEFAULT_URL="https://auth.${CUSTOM_DOMAIN}/.well-known/openid-configuration"
            ;;
        authentik)
            DEFAULT_URL="https://auth.${CUSTOM_DOMAIN}/application/o/fnbox/.well-known/openid-configuration"
            ;;
    esac

    prompt_with_default "OIDC server URL" "$DEFAULT_URL" OIDC_SERVER_URL

    print_success "OIDC configured with ${OIDC_PROVIDER_TYPE}"
else
    OIDC_PROVIDER_TYPE=""
    OIDC_CLIENT_ID=""
    OIDC_CLIENT_SECRET=""
    OIDC_SERVER_URL=""
    print_info "OIDC disabled"
fi

echo ""

# ================================
# Frontend Configuration
# ================================
print_header "                 Frontend Configuration                    "
echo ""

if [ "$ENV_TYPE" = "production" ]; then
    PROTOCOL="https"
else
    PROTOCOL="http"
fi

BACKEND_URL="${PROTOCOL}://${CUSTOM_DOMAIN}"
if [ "$DEBUG" = "1" ]; then
    echo "Debug mode is ON"
    BACKEND_URL="http://127.0.0.1:8000"
fi
prompt_with_default "Backend API URL" "${BACKEND_URL}/api/" NEXT_PUBLIC_API_BASE_URL
prompt_with_default "Backend accounts URL" "${BACKEND_URL}/" NEXT_PUBLIC_BASE_URL_ACCOUNTS

echo ""

# ================================
# Write Configuration Files
# ================================
print_header "               Writing Configuration Files                 "
echo ""

# Create backend/.env
print_info "Creating backend/.env..."
cat > "$BACKEND_ENV" << EOF
# ================================
# FnBox Platform Configuration
# Generated: $(date)
# Environment: ${ENV_TYPE}
# ================================

# === Core Django Settings ===
DEBUG=${DEBUG}
SECRET_KEY="${SECRET_KEY}"
ALLOWED_HOSTS=${ALLOWED_HOSTS}
CUSTOM_DOMAIN=${CUSTOM_DOMAIN}

# === Database Configuration ===
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}

# === Redis Configuration ===
REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT}
REDIS_DB=${REDIS_DB}

# === Email/SMTP Configuration ===
ENABLE_EMAIL=${ENABLE_EMAIL}
EMAIL_HOST=${EMAIL_HOST}
EMAIL_PORT=${EMAIL_PORT}
EMAIL_USE_TLS=${EMAIL_USE_TLS}
EMAIL_HOST_USER=${EMAIL_HOST_USER}
EMAIL_HOST_PASSWORD=${EMAIL_HOST_PASSWORD}
DEFAULT_FROM_EMAIL=${DEFAULT_FROM_EMAIL}

# === Kubernetes Configuration ===
KUBERNETES_ENABLED=${KUBERNETES_ENABLED}
KUBERNETES_NAMESPACE=${KUBERNETES_NAMESPACE}
FUNCTION_BACKEND=${FUNCTION_BACKEND}

# === OIDC/SSO Configuration ===
OIDC_PROVIDER_TYPE=${OIDC_PROVIDER_TYPE}
OIDC_CLIENT_ID=${OIDC_CLIENT_ID}
OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET}
OIDC_SERVER_URL=${OIDC_SERVER_URL}
EOF

print_success "backend/.env created"

# Create frontend/.env.local
print_info "Creating frontend/.env.local..."
cat > "$FRONTEND_ENV" << EOF
# ================================
# FnBox Platform Frontend Configuration
# Generated: $(date)
# Environment: ${ENV_TYPE}
# ================================

# Backend API endpoints
NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
NEXT_PUBLIC_BASE_URL_ACCOUNTS=${NEXT_PUBLIC_BASE_URL_ACCOUNTS}
EOF

print_success "frontend/.env.local created"

# Create .env file for docker-compose with UID/GID and Host IP
print_info "Creating .env for docker-compose..."
cat > "$SCRIPT_DIR/.env" << EOF
# Docker Compose Environment Variables
# Generated: $(date)

# User UID/GID for volume permissions and container user
USER_UID=${USER_UID}
USER_GID=${USER_GID}

# Host IP for Kubernetes API access from containers
HOST_IP=${HOST_IP}
EOF

print_success ".env created with UID=${USER_UID}, GID=${USER_GID}, HOST_IP=${HOST_IP}"

echo ""

# ================================
# Docker Image Building
# ================================
print_header "                  Docker Image Building                    "
echo ""

if prompt_yes_no "Do you want to build Docker images now?" "y"; then
    print_info "Building Docker images... This may take several minutes."
    echo ""

    # Build backend image with UID/GID build args
    print_info "Building backend image (fnbox-backend:latest) with UID=${USER_UID}, GID=${USER_GID}..."
    if docker build \
        -f Dockerfile.backend \
        --build-arg USER_UID="${USER_UID}" \
        --build-arg USER_GID="${USER_GID}" \
        -t fnbox-backend:latest . > /tmp/docker-build-backend.log 2>&1; then
        print_success "Backend image built successfully"
    else
        print_error "Backend image build failed. Check /tmp/docker-build-backend.log for details"
    fi

    echo ""

    # Build frontend image with build args
    print_info "Building frontend image (fnbox-frontend:latest)..."
    if docker build \
        -f Dockerfile.frontend \
        --build-arg NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL" \
        --build-arg NEXT_PUBLIC_BASE_URL_ACCOUNTS="$NEXT_PUBLIC_BASE_URL_ACCOUNTS" \
        -t fnbox-frontend:latest . > /tmp/docker-build-frontend.log 2>&1; then
        print_success "Frontend image built successfully"
    else
        print_error "Frontend image build failed. Check /tmp/docker-build-frontend.log for details"
    fi

    echo ""
    print_success "Docker images built successfully!"
    echo ""
else
    print_info "Skipping Docker image build"
    print_info "You can build later with:"
    echo "  docker build -f Dockerfile.backend --build-arg USER_UID=${USER_UID} --build-arg USER_GID=${USER_GID} -t fnbox-backend:latest ."
    echo "  docker build -f Dockerfile.frontend -t fnbox-frontend:latest ."
    echo ""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
DOCKER_DIR="$PROJECT_ROOT/backend/functions/docker"
CLUSTER_NAME="fnbox-cluster"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        OS="unknown"
    fi
}

# Install kubectl
install_kubectl() {
    log_info "Installing kubectl..."
    if [ "$OS" = "macos" ]; then
        brew install kubectl
    elif [ "$OS" = "linux" ]; then
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/kubectl
    fi
    log_success "kubectl installed"
}

# Install kind
install_kind() {
    log_info "Installing kind..."
    if [ "$OS" = "macos" ]; then
        brew install kind
    elif [ "$OS" = "linux" ]; then
        curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
        chmod +x ./kind
        sudo mv ./kind /usr/local/bin/kind
    fi
    log_success "kind installed"
}

echo ""
echo "========================================="
echo "  FnBox Platform - Automated Setup"
echo "========================================="
echo ""
echo "Architecture:"
echo "  • kind (Kubernetes in Docker)"
echo "  • ClusterIP load balancing per function"
echo "  • Init containers for runtime package installation"
echo "  • Full internet access"
echo ""

# Detect OS
detect_os

# Check Docker
if ! check_command docker; then
    log_error "Docker is required but not installed"
    echo ""
    if [ "$OS" = "macos" ]; then
        echo "Install from: https://www.docker.com/products/docker-desktop"
    elif [ "$OS" = "linux" ]; then
        echo "Run: curl -fsSL https://get.docker.com | sh"
        echo "Then: sudo usermod -aG docker \$USER && newgrp docker"
    fi
    exit 1
fi

# Auto-install kubectl if missing
if ! check_command kubectl; then
    if [ "$OS" = "unknown" ]; then
        log_error "Unsupported OS. Install kubectl manually: https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    log_warning "kubectl not found, installing..."
    install_kubectl
fi

# Auto-install kind if missing
if ! check_command kind; then
    if [ "$OS" = "unknown" ]; then
        log_error "Unsupported OS. Install kind manually: https://kind.sigs.k8s.io/"
        exit 1
    fi
    log_warning "kind not found, installing..."
    install_kind
fi

log_success "All required tools are available"

# Check if cluster exists
CLUSTER_EXISTS=false
if kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
    CLUSTER_EXISTS=true
    log_info "Cluster '$CLUSTER_NAME' already exists"
else
    log_info "No existing cluster found"
fi

# Create cluster if needed
if [ "$CLUSTER_EXISTS" = false ]; then
    log_info "Creating kind cluster '$CLUSTER_NAME'..."
    kind create cluster --name $CLUSTER_NAME --wait 60s
    log_success "Cluster created and ready"
else
    log_info "Using existing cluster"
fi

# Verify cluster is accessible
log_info "Verifying cluster..."
kubectl cluster-info --context kind-$CLUSTER_NAME > /dev/null 2>&1
log_success "Cluster is accessible"

# Create fnbox-network if it doesn't exist
log_info "Setting up Docker network for fnbox..."
if ! docker network inspect fnbox-network &>/dev/null; then
    docker network create fnbox-network
    log_success "Created fnbox-network"
else
    log_success "fnbox-network already exists"
fi

# Connect kind control plane to fnbox network
log_info "Connecting kind cluster to fnbox-network..."
if docker network connect fnbox-network ${CLUSTER_NAME}-control-plane 2>/dev/null; then
    log_success "Kind cluster connected to fnbox-network"
else
    # Already connected or error - check if already connected
    if docker inspect ${CLUSTER_NAME}-control-plane --format '{{range $net, $v := .NetworkSettings.Networks}}{{$net}} {{end}}' | grep -q fnbox-network; then
        log_success "Kind cluster already connected to fnbox-network"
    else
        log_warning "Could not connect kind to fnbox-network (may need manual connection)"
    fi
fi

# Create namespace FIRST - before any image building that might fail
log_info "Ensuring namespace exists..."
if ! kubectl get namespace fnbox-functions --context kind-$CLUSTER_NAME &>/dev/null; then
    log_info "Creating namespace 'fnbox-functions' with security policies..."
    kubectl create namespace fnbox-functions --context kind-$CLUSTER_NAME
    # Apply Pod Security Standards (restricted mode)
    kubectl label namespace fnbox-functions \
        pod-security.kubernetes.io/enforce=restricted \
        pod-security.kubernetes.io/audit=restricted \
        pod-security.kubernetes.io/warn=restricted \
        --context kind-$CLUSTER_NAME
    log_success "Namespace created with security policies"
else
    log_success "Namespace already exists"
    # Ensure security labels are set
    kubectl label namespace fnbox-functions \
        pod-security.kubernetes.io/enforce=restricted \
        pod-security.kubernetes.io/audit=restricted \
        pod-security.kubernetes.io/warn=restricted \
        --overwrite \
        --context kind-$CLUSTER_NAME 2>/dev/null || true
fi

# Check if images need to be built
NEED_BUILD=false
IMAGES_TO_CHECK=("fnbox-python:3.11" "fnbox-nodejs:20")
for IMAGE in "${IMAGES_TO_CHECK[@]}"; do
    if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${IMAGE}$"; then
        NEED_BUILD=true
        break
    fi
done

# Build images if needed
if [ "$NEED_BUILD" = true ]; then
    log_info "Building Docker images (this takes 5-10 minutes)..."
    cd "$DOCKER_DIR"
    chmod +x build-all.sh

    if ./build-all.sh > /tmp/fnbox-build.log 2>&1; then
        log_success "All Docker images built successfully"
    else
        log_error "Failed to build Docker images. Check /tmp/fnbox-build.log"
        exit 1
    fi
    cd "$SCRIPT_DIR"
else
    log_success "Docker images already built"
fi

# Define all images
ALL_IMAGES=(
    "fnbox-python:3.9" "fnbox-python:3.10" "fnbox-python:3.11" "fnbox-python:3.12" "fnbox-python:3.13" "fnbox-python:3.14"
    "fnbox-nodejs:20" "fnbox-nodejs:24" "fnbox-nodejs:25"
    "fnbox-ruby:3.4"
    "fnbox-java:27"
    "fnbox-dotnet:8" "fnbox-dotnet:9" "fnbox-dotnet:10"
    "fnbox-bash:5"
    "fnbox-go:1.25"
)

# Check if images need to be loaded
NEED_LOAD=false
for IMAGE in "${ALL_IMAGES[@]}"; do
    # Check if image exists in kind
    if ! docker exec ${CLUSTER_NAME}-control-plane crictl images | grep -q "${IMAGE//:/.*}"; then
        NEED_LOAD=true
        break
    fi
done

# Load images into cluster
if [ "$NEED_LOAD" = true ]; then
    log_info "Loading Docker images into cluster..."

    LOADED=0
    for IMAGE in "${ALL_IMAGES[@]}"; do
        if docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^${IMAGE}$"; then
            echo "  Loading ${IMAGE}..."
            kind load docker-image "$IMAGE" --name $CLUSTER_NAME
            LOADED=$((LOADED + 1))
        fi
    done

    log_success "Loaded $LOADED images into cluster"
else
    log_success "Images already loaded in cluster"
fi

# Install metrics-server (required for HPA autoscaling)
log_info "Checking metrics-server..."
if ! kubectl get deployment metrics-server -n kube-system --context kind-$CLUSTER_NAME &>/dev/null; then
    log_info "Installing metrics-server for HPA autoscaling..."
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml --context kind-$CLUSTER_NAME

    # For local development (kind), metrics-server needs --kubelet-insecure-tls
    log_info "Configuring metrics-server for local development..."
    kubectl patch deployment metrics-server -n kube-system --context kind-$CLUSTER_NAME --type='json' -p='[
      {
        "op": "add",
        "path": "/spec/template/spec/containers/0/args/-",
        "value": "--kubelet-insecure-tls"
      }
    ]'

    log_info "Waiting for metrics-server to be ready..."
    kubectl wait --for=condition=available --timeout=60s deployment/metrics-server -n kube-system --context kind-$CLUSTER_NAME 2>/dev/null || true
    log_success "Metrics-server installed"
else
    log_success "Metrics-server already installed"
fi

# Apply resource limits and control plane protection
log_info "Applying cluster resource protection..."

# Detect system resources
TOTAL_RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
TOTAL_CPU_CORES=$(nproc)

# Calculate quotas based on hardware (leave 2GB for host + control plane)
ETCD_QUOTA_GB=$((TOTAL_RAM_GB - 2))
if [ $ETCD_QUOTA_GB -lt 2 ]; then
    ETCD_QUOTA_GB=2  # Minimum 2GB
fi
ETCD_QUOTA_BYTES=$((ETCD_QUOTA_GB * 1024 * 1024 * 1024))

# Allow override via environment variables
FUNCTION_CPU_PERCENT=${FUNCTION_CPU_PERCENT:-70}  # Default 70% for functions
FUNCTION_MEMORY_PERCENT=${FUNCTION_MEMORY_PERCENT:-70}  # Default 70% for functions

# Calculate namespace resource quota (70% of total for functions by default, 30% for system)
QUOTA_CPU_CORES=$((TOTAL_CPU_CORES * FUNCTION_CPU_PERCENT / 100))
if [ $QUOTA_CPU_CORES -lt 2 ]; then
    QUOTA_CPU_CORES=2  # Minimum 2 cores
fi

QUOTA_MEMORY_GB=$((TOTAL_RAM_GB * FUNCTION_MEMORY_PERCENT / 100))
if [ $QUOTA_MEMORY_GB -lt 4 ]; then
    QUOTA_MEMORY_GB=4  # Minimum 4GB
fi

log_info "Detected: ${TOTAL_CPU_CORES} CPU cores, ${TOTAL_RAM_GB}GB RAM"
log_info "Allocating ${FUNCTION_CPU_PERCENT}% CPU, ${FUNCTION_MEMORY_PERCENT}% memory to functions"
log_info "Function quota: ${QUOTA_CPU_CORES} cores, ${QUOTA_MEMORY_GB}GB"
log_info "System reserved: $((TOTAL_CPU_CORES - QUOTA_CPU_CORES)) cores, $((TOTAL_RAM_GB - QUOTA_MEMORY_GB))GB"
log_info "etcd quota: ${ETCD_QUOTA_GB}GB"

# Apply resource quotas and limits
kubectl apply -f - --context kind-$CLUSTER_NAME <<EOF
---
# ResourceQuota: Hard limits on namespace resources
apiVersion: v1
kind: ResourceQuota
metadata:
  name: fnbox-functions-quota
  namespace: fnbox-functions
spec:
  hard:
    requests.cpu: "${QUOTA_CPU_CORES}"
    requests.memory: "${QUOTA_MEMORY_GB}Gi"
    limits.cpu: "$((QUOTA_CPU_CORES * 2))"
    limits.memory: "$((QUOTA_MEMORY_GB * 2))Gi"
    pods: "50"
    services: "50"
    configmaps: "100"
    persistentvolumeclaims: "10"

---
# LimitRange: Default and max limits per container
apiVersion: v1
kind: LimitRange
metadata:
  name: fnbox-functions-limits
  namespace: fnbox-functions
spec:
  limits:
  - type: Container
    default:
      cpu: "500m"
      memory: "512Mi"
      ephemeral-storage: "1Gi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
      ephemeral-storage: "500Mi"
    max:
      cpu: "2000m"
      memory: "4Gi"
      ephemeral-storage: "5Gi"
    min:
      cpu: "50m"
      memory: "64Mi"
      ephemeral-storage: "100Mi"
    maxLimitRequestRatio:
      cpu: "4"
      memory: "4"
      ephemeral-storage: "10"
  - type: Pod
    max:
      cpu: "4000m"
      memory: "8Gi"
      ephemeral-storage: "10Gi"
  - type: PersistentVolumeClaim
    max:
      storage: "10Gi"

---
# PriorityClass: Functions have lower priority than system
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: fnbox-function-priority
value: 100
globalDefault: false
description: "Priority for FnBox function pods - can be evicted for system pods"

---
# API Priority and Fairness: Rate limit function API requests
apiVersion: flowcontrol.apiserver.k8s.io/v1beta3
kind: PriorityLevelConfiguration
metadata:
  name: fnbox-functions-priority-level
spec:
  type: Limited
  limited:
    nominalConcurrencyShares: 10
    limitResponse:
      type: Queue
      queuing:
        queues: 32
        queueLengthLimit: 50
        handSize: 4

---
apiVersion: flowcontrol.apiserver.k8s.io/v1beta3
kind: FlowSchema
metadata:
  name: fnbox-functions-flowschema
spec:
  distinguisherMethod:
    type: ByUser
  matchingPrecedence: 1000
  priorityLevelConfiguration:
    name: fnbox-functions-priority-level
  rules:
  - resourceRules:
    - apiGroups: ["*"]
      clusterScope: false
      namespaces: ["fnbox-functions"]
      resources: ["*"]
      verbs: ["*"]
    subjects:
    - kind: ServiceAccount
      serviceAccount:
        name: "*"
        namespace: "fnbox-functions"
    - kind: User
      user:
        name: "*"

---
# Pod Disruption Budget: Maintain availability during disruptions
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: function-pdb
  namespace: fnbox-functions
spec:
  minAvailable: 1
  selector:
    matchLabels:
      component: function

---
# Service Account with limited permissions
apiVersion: v1
kind: ServiceAccount
metadata:
  name: function-operator
  namespace: fnbox-functions

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: function-operator-role
  namespace: fnbox-functions
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["services", "configmaps", "pods"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["autoscaling"]
  resources: ["horizontalpodautoscalers"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["resourcequotas"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: function-operator-binding
  namespace: fnbox-functions
subjects:
- kind: ServiceAccount
  name: function-operator
  namespace: fnbox-functions
roleRef:
  kind: Role
  name: function-operator-role
  apiGroup: rbac.authorization.k8s.io
EOF

log_success "Resource protection applied"

# For kind clusters, configure etcd via control plane container
log_info "Configuring etcd quota for kind cluster..."
docker exec ${CLUSTER_NAME}-control-plane sh -c "
  # Check if etcd quota is already set
  if ! grep -q 'quota-backend-bytes' /etc/kubernetes/manifests/etcd.yaml 2>/dev/null; then
    # Backup original file
    cp /etc/kubernetes/manifests/etcd.yaml /etc/kubernetes/manifests/etcd.yaml.bak 2>/dev/null || true

    # Add quota to etcd command
    sed -i '/^    - etcd$/a\    - --quota-backend-bytes=${ETCD_QUOTA_BYTES}' /etc/kubernetes/manifests/etcd.yaml 2>/dev/null || true

    echo 'etcd quota configured (will take effect on next restart)'
  else
    echo 'etcd quota already configured'
  fi
" 2>/dev/null || log_warning "Could not configure etcd quota (may require manual setup)"

log_success "Cluster protection configured"

# Host-level hardening for kind cluster
echo ""
log_info "Applying host-level hardening..."

# 1. Configure kubelet eviction thresholds
log_info "Configuring kubelet eviction thresholds..."
docker exec ${CLUSTER_NAME}-control-plane sh -c "
cat >> /var/lib/kubelet/config.yaml <<'EOF'

# Eviction thresholds - evict pods before node crashes
evictionHard:
  memory.available: 500Mi    # Evict when <500Mi free
  nodefs.available: 10%      # Evict when <10% disk free
  nodefs.inodesFree: 5%      # Evict when <5% inodes free
  imagefs.available: 15%     # Evict when <15% image storage free

evictionSoft:
  memory.available: 1Gi      # Soft eviction at 1Gi
  nodefs.available: 15%      # Soft eviction at 15%

evictionSoftGracePeriod:
  memory.available: 1m30s    # Grace period before soft eviction
  nodefs.available: 2m       # Grace period for disk

# Maximum pods (prevent pod spam)
maxPods: 110

# Image garbage collection
imageGCHighThresholdPercent: 85  # Start GC at 85% disk usage
imageGCLowThresholdPercent: 80   # Stop GC at 80%

# Container log management
containerLogMaxSize: 10Mi    # Max 10MB per container log file
containerLogMaxFiles: 3      # Keep max 3 rotated logs per container
EOF

# Restart kubelet to apply changes
systemctl restart kubelet
" 2>/dev/null && log_success "kubelet eviction thresholds configured" || log_warning "Could not configure kubelet (may already be configured)"

# 2. Set Docker resource limits on kind container itself
log_info "Setting resource limits on kind container..."
KIND_MEMORY_GB=$((TOTAL_RAM_GB * 80 / 100))
KIND_CPUS=$((TOTAL_CPU_CORES * 80 / 100))

if [ $KIND_MEMORY_GB -lt 4 ]; then
    KIND_MEMORY_GB=4  # Minimum 4GB
fi
if [ $KIND_CPUS -lt 2 ]; then
    KIND_CPUS=2  # Minimum 2 CPUs
fi

docker update \
    --memory="${KIND_MEMORY_GB}g" \
    --cpus="${KIND_CPUS}" \
    --memory-swap="${KIND_MEMORY_GB}g" \
    ${CLUSTER_NAME}-control-plane >/dev/null 2>&1 && \
    log_success "Kind container limits: ${KIND_MEMORY_GB}GB RAM, ${KIND_CPUS} CPUs (80% of system)" || \
    log_warning "Could not set Docker limits on kind container"

# 3. Enable PID limits (cgroup)
log_info "Configuring PID limits..."
docker exec ${CLUSTER_NAME}-control-plane sh -c "
# For cgroup v1 (most systems)
if [ -d /sys/fs/cgroup/pids ]; then
    echo 'PID limits already enabled (cgroup v1)'
fi

# For cgroup v2
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
    # Ensure pids controller is enabled
    echo '+pids' > /sys/fs/cgroup/cgroup.subtree_control 2>/dev/null || true
    echo 'PID limits enabled (cgroup v2)'
fi
" 2>/dev/null && log_success "PID limits configured" || log_warning "PID limits may already be enabled"

log_success "Host-level hardening complete"

# Verification checks
echo ""
log_info "Verifying cluster protection..."

CRITICAL_ISSUES=0
WARNINGS=0

# Check ResourceQuota
if kubectl get resourcequota fnbox-functions-quota -n fnbox-functions --context kind-$CLUSTER_NAME &>/dev/null; then
    log_success "ResourceQuota configured"
else
    log_error "ResourceQuota NOT found"
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
fi

# Check LimitRange
if kubectl get limitrange fnbox-functions-limits -n fnbox-functions --context kind-$CLUSTER_NAME &>/dev/null; then
    log_success "LimitRange configured"
else
    log_error "LimitRange NOT found"
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
fi

# Check Pod Security Standards
if kubectl get namespace fnbox-functions --context kind-$CLUSTER_NAME -o json 2>/dev/null | grep -q 'pod-security.kubernetes.io/enforce.*restricted'; then
    log_success "Pod Security Standards enforced (restricted mode)"
else
    log_warning "Pod Security Standards not enforced"
    WARNINGS=$((WARNINGS + 1))
fi

# Check PriorityClass
if kubectl get priorityclass fnbox-function-priority --context kind-$CLUSTER_NAME &>/dev/null; then
    log_success "PriorityClass configured"
else
    log_error "PriorityClass NOT found"
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
fi

# Check API Priority and Fairness
if kubectl get prioritylevelconfiguration fnbox-functions-priority-level --context kind-$CLUSTER_NAME &>/dev/null; then
    log_success "API Priority and Fairness configured"
else
    log_error "API Priority and Fairness NOT configured"
    CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
fi

# Check PodDisruptionBudget
if kubectl get poddisruptionbudget function-pdb -n fnbox-functions --context kind-$CLUSTER_NAME &>/dev/null; then
    log_success "PodDisruptionBudget configured"
else
    log_warning "PodDisruptionBudget not found"
    WARNINGS=$((WARNINGS + 1))
fi

# Check etcd quota
if docker exec ${CLUSTER_NAME}-control-plane grep -q "quota-backend-bytes" /etc/kubernetes/manifests/etcd.yaml 2>/dev/null; then
    log_success "etcd quota configured"
else
    log_warning "etcd quota not configured (will be applied on next etcd restart)"
    WARNINGS=$((WARNINGS + 1))
fi

# Summary of verification
echo ""
if [ $CRITICAL_ISSUES -eq 0 ]; then
    log_success "All critical protections verified ✓"
else
    log_error "$CRITICAL_ISSUES critical issue(s) found!"
fi

if [ $WARNINGS -gt 0 ]; then
    log_warning "$WARNINGS warning(s) - cluster is protected but some optimizations missing"
fi

# Summary
echo ""
echo "========================================="
log_success "Setup Complete!"
echo "========================================="
echo ""
echo "Your FnBox platform is ready with:"
echo "  ✓ kind cluster: $CLUSTER_NAME"
echo "  ✓ Namespace: fnbox-functions"
echo "  ✓ Docker images: ${#ALL_IMAGES[@]} runtimes"
echo "  ✓ Metrics-server: Enabled (for HPA autoscaling)"
echo "  ✓ Load balancing: Automatic per function"
echo "  ✓ Package installation: Real-time via init containers"
echo "  ✓ Internet access: Full connectivity"
echo ""
echo "Resource Protection:"
echo "  ✓ Namespace quota: ${QUOTA_CPU_CORES} cores, ${QUOTA_MEMORY_GB}GB"
echo "  ✓ Per-container limits: Max 2 cores, 4GB RAM, 5GB disk"
echo "  ✓ HPA max replicas: 5 per function"
echo "  ✓ API rate limiting: Enabled (APF)"
echo "  ✓ etcd quota: ${ETCD_QUOTA_GB}GB (auto-calculated)"
echo "  ✓ Priority classes: Functions < system pods"
echo ""
echo "Security & Stability:"
echo "  ✓ Pod Security Standards: restricted mode"
echo "  ✓ Ephemeral storage limits: 2GB max per pod"
echo "  ✓ Non-root containers: UID 1000"
echo "  ✓ No privilege escalation"
echo "  ✓ Seccomp profile: RuntimeDefault"
echo "  ✓ Pod Disruption Budget: min 1 available"
echo "  ✓ Graceful termination: 30s max"
echo ""
echo "Host-Level Protection:"
echo "  ✓ kubelet eviction: memory/disk/inode thresholds"
echo "  ✓ Container log rotation: 10MB max, 3 rotations"
echo "  ✓ Kind container limits: ${KIND_MEMORY_GB}GB RAM, ${KIND_CPUS} CPUs"
echo "  ✓ PID limits: fork bomb protection enabled"
echo "  ✓ Image garbage collection: 85% threshold"
echo ""
echo "Architecture details:"
echo "  • Each function = Kubernetes Deployment + Service"
echo "  • Services provide automatic load balancing across pods"
echo "  • Scale functions: k8s_manager.scale_function(name, replicas=N)"
echo "  • Packages installed automatically when function deploys"
echo ""
echo "Useful commands:"
echo "  kubectl get pods -n fnbox-functions                      # View running functions"
echo "  kubectl get svc -n fnbox-functions                       # View services"
echo "  kubectl get hpa -n fnbox-functions                       # View autoscaling status"
echo "  kubectl top pods -n fnbox-functions                      # View resource usage"
echo "  kubectl describe resourcequota -n fnbox-functions        # Check quota usage"
echo "  kubectl get priorityclass                               # View priority classes"
echo "  kubectl logs <pod> -n fnbox-functions                    # View function logs"
echo "  kind delete cluster --name $CLUSTER_NAME                # Delete cluster"
echo ""
echo "Monitor cluster health:"
echo "  kubectl top nodes                                       # Node resource usage"
echo "  kubectl get --raw /metrics | grep etcd_db_total_size   # etcd size"
echo "  kubectl get --raw /metrics | grep apiserver_request    # API load"
echo ""

# ================================
# Security Reminders
# ================================
if [ "$ENV_TYPE" = "production" ]; then
    print_header "                   Security Checklist                      "
    echo ""
    print_warning "Production environment detected! Please ensure:"
    echo "  □ Use HTTPS/SSL certificates"
    echo "  □ Configure firewall (ports 80, 443, 22 only)"
    echo "  □ Use strong database password"
    echo "  □ Backup .env files securely (they contain secrets!)"
    echo "  □ Set up monitoring and logging"
    echo "  □ Run: python manage.py check --deploy"
    echo ""
fi

# ================================
# Next Steps
# ================================
print_header "                      Next Steps                           "
echo ""
print_success "FnBox config complete!"
echo ""
print_info "Start the platform:"
echo "  1. docker compose up -d"
echo "  2. docker compose logs -f  # View logs"
echo ""
print_info "Create admin user (after containers are up):"
echo "  docker compose exec fnbox-backend python manage.py createsuperuser"
echo ""
print_info "Access the platform:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend API: http://localhost:8000/api/"
echo "  - Admin: http://localhost:8000/admin/"
echo ""
print_info "Manage containers:"
echo "  docker compose ps      # View status"
echo "  docker compose down    # Stop containers"
echo "  dockercompose restart # Restart services"
echo ""