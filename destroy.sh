#!/bin/bash
set -e

# Kubernetes Teardown Script for FnBox Platform
# Provides options to clean up functions or completely remove the cluster

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLUSTER_NAME="fnbox-cluster"
NAMESPACE="fnbox-functions"

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

# Function to delete all function deployments
cleanup_functions() {
    log_info "Cleaning up all function deployments..."

    if ! kubectl get namespace "$NAMESPACE" --context kind-$CLUSTER_NAME &>/dev/null; then
        log_warning "Namespace '$NAMESPACE' does not exist"
        return 0
    fi

    # Get all deployments in the namespace
    DEPLOYMENTS=$(kubectl get deployments -n "$NAMESPACE" --context kind-$CLUSTER_NAME -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")

    if [ -z "$DEPLOYMENTS" ]; then
        log_info "No function deployments found"
        return 0
    fi

    COUNT=0
    for DEPLOYMENT in $DEPLOYMENTS; do
        log_info "Deleting function: $DEPLOYMENT"

        # Delete HPA
        HPA_NAME="${DEPLOYMENT}-hpa"
        kubectl delete hpa "$HPA_NAME" -n "$NAMESPACE" --context kind-$CLUSTER_NAME --ignore-not-found=true &>/dev/null

        # Delete Service
        SVC_NAME="${DEPLOYMENT}-svc"
        kubectl delete svc "$SVC_NAME" -n "$NAMESPACE" --context kind-$CLUSTER_NAME --ignore-not-found=true &>/dev/null

        # Delete ConfigMap
        kubectl delete configmap "$DEPLOYMENT" -n "$NAMESPACE" --context kind-$CLUSTER_NAME --ignore-not-found=true &>/dev/null

        # Delete Deployment
        kubectl delete deployment "$DEPLOYMENT" -n "$NAMESPACE" --context kind-$CLUSTER_NAME --ignore-not-found=true &>/dev/null

        COUNT=$((COUNT + 1))
    done

    log_success "Deleted $COUNT function deployment(s)"

    # Wait for pods to terminate
    log_info "Waiting for pods to terminate..."
    kubectl wait --for=delete pod --all -n "$NAMESPACE" --context kind-$CLUSTER_NAME --timeout=30s &>/dev/null || true
    log_success "All function pods terminated"
}

# Function to delete the entire namespace
delete_namespace() {
    log_info "Deleting namespace '$NAMESPACE'..."

    if kubectl get namespace "$NAMESPACE" --context kind-$CLUSTER_NAME &>/dev/null; then
        kubectl delete namespace "$NAMESPACE" --context kind-$CLUSTER_NAME --timeout=60s
        log_success "Namespace deleted"
    else
        log_warning "Namespace '$NAMESPACE' does not exist"
    fi
}

# Function to delete the entire cluster
delete_cluster() {
    log_info "Deleting kind cluster '$CLUSTER_NAME'..."

    if kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
        kind delete cluster --name "$CLUSTER_NAME"
        log_success "Cluster deleted"
    else
        log_warning "Cluster '$CLUSTER_NAME' does not exist"
    fi
}

# Function to kill any orphaned kubectl processes
cleanup_kubectl_processes() {
    log_info "Checking for orphaned kubectl processes..."

    PIDS=$(pgrep -f "kubectl port-forward.*$NAMESPACE" || true)

    if [ -z "$PIDS" ]; then
        log_info "No orphaned kubectl processes found"
        return 0
    fi

    COUNT=0
    for PID in $PIDS; do
        kill "$PID" 2>/dev/null || true
        COUNT=$((COUNT + 1))
    done

    log_success "Killed $COUNT orphaned kubectl process(es)"
}

# Display banner
echo ""
echo "========================================="
echo "  FnBox Platform - Teardown"
echo "========================================="
echo ""

# Check if kubectl is available
if ! check_command kubectl; then
    log_error "kubectl is required but not installed"
    exit 1
fi

# Check if kind is available
if ! check_command kind; then
    log_error "kind is required but not installed"
    exit 1
fi

# Check if cluster exists
CLUSTER_EXISTS=false
if kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
    CLUSTER_EXISTS=true
fi

if [ "$CLUSTER_EXISTS" = false ]; then
    log_warning "Cluster '$CLUSTER_NAME' does not exist"
    echo ""
    echo "Nothing to clean up!"
    exit 0
fi

# Parse command line arguments
MODE="ask"
if [ "$1" = "--functions" ]; then
    MODE="functions"
elif [ "$1" = "--cluster" ]; then
    MODE="cluster"
elif [ "$1" = "--all" ]; then
    MODE="all"
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --functions    Delete only function deployments (keep cluster)"
    echo "  --cluster      Delete the entire cluster"
    echo "  --all          Delete everything (functions + cluster)"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "If no option is provided, you will be prompted interactively."
    exit 0
fi

# Interactive mode
if [ "$MODE" = "ask" ]; then
    echo "What would you like to clean up?"
    echo ""
    echo "  1) Functions only (keep cluster running)"
    echo "  2) Entire cluster (complete teardown)"
    echo "  3) Cancel"
    echo ""
    read -p "Enter choice [1-3]: " choice

    case $choice in
        1)
            MODE="functions"
            ;;
        2)
            MODE="cluster"
            ;;
        3)
            log_info "Cancelled by user"
            exit 0
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
fi

echo ""
log_info "Teardown mode: $MODE"
echo ""

# Execute teardown based on mode
case $MODE in
    functions)
        cleanup_kubectl_processes
        cleanup_functions
        echo ""
        echo "========================================="
        log_success "Function Cleanup Complete!"
        echo "========================================="
        echo ""
        echo "The cluster is still running with:"
        echo "  ✓ Cluster: $CLUSTER_NAME"
        echo "  ✓ Namespace: $NAMESPACE (empty)"
        echo "  ✓ Metrics-server: Running"
        echo ""
        echo "You can deploy new functions through the web interface."
        echo ""
        ;;

    cluster|all)
        cleanup_kubectl_processes
        delete_cluster
        echo ""
        echo "========================================="
        log_success "Complete Teardown Finished!"
        echo "========================================="
        echo ""
        echo "All resources have been removed:"
        echo "  ✓ All function deployments deleted"
        echo "  ✓ Namespace '$NAMESPACE' deleted"
        echo "  ✓ Cluster '$CLUSTER_NAME' deleted"
        echo ""
        echo "To set up again, run:"
        echo "  $SCRIPT_DIR/setup-kubernetes.sh"
        echo ""
        ;;

    *)
        log_error "Unknown mode: $MODE"
        exit 1
        ;;
esac

# Ask about Docker data retention
echo ""
echo "========================================="
echo "  Docker Cleanup"
echo "========================================="
echo ""
log_warning "Do you want to remove Docker volumes (database, logs, etc.)?"
echo ""
echo "  1) Keep data (docker compose down)"
echo "  2) Remove all data (docker compose down -v)"
echo "  3) Skip Docker cleanup"
echo ""
read -p "Enter choice [1-3]: " docker_choice

case $docker_choice in
    1)
        log_info "Stopping Docker containers (keeping data)..."
        docker compose down
        log_success "Docker containers stopped. Data volumes preserved."
        ;;
    2)
        log_warning "Removing Docker containers AND volumes..."
        read -p "Are you sure? All data will be lost! [y/N]: " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            docker compose down -v
            log_success "Docker containers and volumes removed."
        else
            log_info "Cancelled. Running 'docker compose down' instead..."
            docker compose down
            log_success "Docker containers stopped. Data volumes preserved."
        fi
        ;;
    3)
        log_info "Skipping Docker cleanup"
        ;;
    *)
        log_warning "Invalid choice. Skipping Docker cleanup."
        ;;
esac

echo ""