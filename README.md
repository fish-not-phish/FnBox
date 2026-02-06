# 🚀 FnBox - Serverless Functions Platform

<div align="center">

**A modern, production-ready serverless functions platform built with Django, Next.js, and Kubernetes**

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Enabled-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![Django](https://img.shields.io/badge/Django-5.1-092E20?logo=django)](https://www.djangoproject.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](https://www.python.org/)

[Features](#-features) •
[Quick Start](#-quick-start) •
[Documentation](#-documentation) •
[Deployment](#-deployment) •
[Architecture](#-architecture)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Deployment](#-deployment)
  - [Docker Compose](#docker-compose-local-development)
  - [Production with Traefik](#production-with-traefik)
  - [Kubernetes Setup](#kubernetes-setup)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

FnBox is a self-hosted serverless functions platform that allows you to deploy, manage, and scale functions with ease. Built for developers who want control over their infrastructure without sacrificing the simplicity of serverless.

### Why FnBox?

- **🔒 Self-Hosted**: Full control over your data and infrastructure
- **🎯 Developer-Friendly**: Intuitive web UI and powerful API
- **⚡ Auto-Scaling**: Kubernetes HPA for automatic scaling based on load
- **🌐 Multi-Runtime**: Support for Python 3.9-3.14, Node.js 20/24/25, Ruby 3.4, Go 1.25, Java 27, .NET 8/9/10, Bash 5
- **🔐 Secure**: OIDC/SSO integration, team management, and secret vaults
- **📊 Observable**: Built-in logging, metrics, and function monitoring
- **🐳 Production-Ready**: Docker-first with Traefik support
- **🧠 Smart Resource Management**: Automatic resource ceiling based on your host machine

---

## ✨ Features

### Core Functionality
- **Multiple Runtimes**:
  - **Full support with dependency management**: Python 3.9-3.14, Node.js 20/24/25, Ruby 3.4
  - **Runtime-only (no dependency sets)**: Go 1.25, Java 27, .NET 8/9/10, Bash 5
- **Auto-Scaling**: Kubernetes HPA with configurable min/max replicas
- **Real-Time Logs**: Stream function execution logs in the dashboard
- **Scheduled Functions**: Cron-based triggers for periodic execution
- **HTTP Triggers**: RESTful endpoints for each function
- **Dependency Management**: Reusable dependency sets for Python, Node.js, and Ruby
- **Smart Resource Limits**: Automatically configured based on host machine capabilities

### Team & Security
- **Team Management**: Multi-team support with role-based access
- **Secret Vault**: Secure secret storage with environment variable injection
- **OIDC/SSO**: Integration with Keycloak, Authelia, Authentik

### Developer Experience
- **Web IDE**: Built-in code editor with syntax highlighting
- **Test Function**: Test functions directly from the UI
- **Invocation History**: View past executions with input/output
- **Resource Limits**: Configure CPU, memory, and timeout per function
- **Dependency Sets**: Reusable package collections across functions

### Infrastructure
- **Kubernetes-Native**: Deployments, Services, HPAs, ConfigMaps
- **Resource Protection**: ResourceQuota, LimitRange, PodDisruptionBudgets
- **Container Registry**: Support for custom base images
- **Load Balancing**: ClusterIP services per function
- **Health Checks**: Automatic pod health monitoring

---

## 🔧 Prerequisites

### Required
- **Docker** (v20.10+) - [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (v2.0+) - Included with Docker Desktop
- **Python 3** - For setup script

### Optional (Auto-installed by setup)
- **kubectl** - Kubernetes CLI
- **kind** - Local Kubernetes cluster

### System Requirements

**Minimum (Development/Testing):**
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 20GB free space

**Recommended (Small Production):**
- **CPU**: 4-6 cores
- **RAM**: 8-16GB
- **Disk**: 50GB free space

**Optimal (Production):**
- **CPU**: 8+ cores
- **RAM**: 32GB+
- **Disk**: 100GB+ SSD

> **Note** FnBox automatically detects your host machine resources and configures Kubernetes resource quotas accordingly. By default, it allocates **70% of CPU and memory to functions**, leaving 30% for system processes. This ensures your host machine remains stable while maximizing function capacity.

---

## 🚀 Quick Start

Get FnBox running in **5 minutes**:

### 1. Clone the Repository
```bash
git clone https://github.com/fish-not-phish/fnbox.git
cd fnbox
```

### Automatic Resource Management

FnBox intelligently manages resources based on your host machine capabilities:

**Default Behavior:**
- Automatically detects total CPU cores and RAM
- Allocates **70% to functions**, **30% to system** (Kubernetes, PostgreSQL, Redis)
- Configures Kubernetes ResourceQuota, LimitRange, and PodDisruptionBudgets
- Prevents cluster overload and ensures host stability

**Customizing Allocation:**

Override the default allocation based on your use case:

```bash
# Dedicated FnBox server (80% to functions)
FUNCTION_CPU_PERCENT=80 FUNCTION_MEMORY_PERCENT=80 ./setup.sh

# Shared server with other workloads (50% to functions)
FUNCTION_CPU_PERCENT=50 FUNCTION_MEMORY_PERCENT=50 ./setup.sh

# Conservative allocation (40% to functions)
FUNCTION_CPU_PERCENT=40 FUNCTION_MEMORY_PERCENT=40 ./setup.sh
```

**Recommended Allocations:**
- **Dedicated FnBox server**: 75-85% - Maximum capacity for function execution
- **Development/Testing**: 60-70% (default) - Balanced performance and stability
- **Shared workloads**: 40-50% - Conservative, shares resources with other apps

**Example: 16GB RAM Machine**
- Default (70%): ~11GB for functions, ~5GB for system
- Dedicated (85%): ~13.6GB for functions, ~2.4GB for system
- Shared (50%): ~8GB for functions, ~8GB for system + other apps

### 2. Run Interactive Setup
```bash
chmod +x setup.sh destroy.sh
```

```bash
./setup.sh
```

The setup script will:
- Create `.env` configuration files
- Generate secure secrets
- Build Docker images
- Configure database and Redis


### 3. Start the Platform
```bash
docker compose up -d
```

### 4. Access the Platform

**The first user to register will automatically become a superuser/admin.**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/
- **Admin Panel**: http://localhost:8000/admin/

---

## ⚙️ Configuration

### Backend Configuration (`backend/.env`)

```bash
# Django Settings
DEBUG=0
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=your-domain.com,localhost
CUSTOM_DOMAIN=your-domain.com

# Database
DB_NAME=fnbox
DB_USER=fnbox
DB_PASSWORD=secure-password
DB_HOST=fnbox-postgres
DB_PORT=5432

# Redis
REDIS_HOST=fnbox-redis
REDIS_PORT=6379
REDIS_DB=0

# Kubernetes
KUBERNETES_ENABLED=True
KUBERNETES_NAMESPACE=fnbox-functions
FUNCTION_BACKEND=kubernetes

# OIDC (Optional)
OIDC_PROVIDER_TYPE=keycloak
OIDC_CLIENT_ID=fnbox-platform
OIDC_CLIENT_SECRET=your-secret
OIDC_SERVER_URL=https://auth.example.com/.well-known/openid-configuration
```

### Frontend Configuration (`frontend/.env.local`)

```bash
# Backend API endpoints
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/
NEXT_PUBLIC_BASE_URL_ACCOUNTS=http://localhost:8000/
```

---

## 🐳 Deployment

### Docker Compose (Local Development)

**Start services:**
```bash
docker compose up -d
```

**View logs:**
```bash
docker compose logs -f
```

**Stop services:**
```bash
docker compose down
```

**Remove all data:**
```bash
docker compose down -v
```

### Production with Traefik

Update `docker-compose.traefik.yml` with your domain:

```yaml
services:
  fnbox-backend:
    labels:
      ...
      - "traefik.http.routers.fnbox-backend.rule=Host(`your-domain.com`) && (PathPrefix(`/api`) || PathPrefix(`/accounts`))"
      ...
```

```yaml
services:
  fnbox-frontend:
    labels:
      ...
      - "traefik.http.routers.fnbox-frontend.rule=Host(`your-domain.com`)"
      ...
```

**Deploy:**
```bash
docker compose -f docker-compose.traefik.yml up -d
```

### Production with Nginx

For those who prefer Nginx over Traefik, we provide a nginx configuration example. However, Nginx is not supported by default. However the configuration files are simple to modify to align with your environment.

**Update domain in `nginx/conf.d/fnbox.conf`:**

```nginx
server_name your-domain.com;  # Change this line
```

**For HTTPS/SSL:** Uncomment the HTTPS server block and configure SSL certificates. See [nginx/README.md](nginx/README.md) for detailed SSL setup.

**Deploy:**
```bash
docker compose -f docker-compose.nginx.yml up -d
```

**Access:**
- Frontend: http://localhost (or your domain)
- Backend API: http://localhost/api/
- Admin: http://localhost/admin/

See [nginx/README.md](nginx/README.md) for advanced configuration, SSL setup, and troubleshooting.


**Teardown:**
```bash
./destroy.sh
```

---

## 📖 Usage

### Creating a Function

1. Navigate to **Functions** → **Create Function**
2. Enter function name and description
3. Select runtime (e.g., Python 3.12, Node.js 20)
4. Write your function code
5. Configure resources (CPU, memory, timeout)
6. Deploy function

### Example Python Function

```python
def handler(event, context):
    """
    Simple hello world function
    """
    name = event.get('name', 'World')
    return {
        'statusCode': 200,
        'body': f'Hello, {name}!'
    }
```

### Example Node.js Function

```javascript
exports.handler = async (event, context) => {
    const name = event.name || 'World';
    return {
        statusCode: 200,
        body: `Hello, ${name}!`
    };
};
```

### Example Ruby Function

```ruby
def handler(event, context)
  name = event['name'] || 'World'
  {
    statusCode: 200,
    body: "Hello, #{name}!"
  }
end
```

### Example Go Function

```go
package main

import "os"

func handler(event map[string]interface{}, context map[string]interface{}) map[string]interface{} {
    name := "World"
    if n, ok := event["name"].(string); ok {
        name = n
    }

    return map[string]interface{}{
        "statusCode": 200,
        "body": map[string]interface{}{
            "message": "Hello, " + name + "!",
        },
    }
}
```

### Example Java Function

```java
import java.util.Map;
import java.util.HashMap;

public class Handler {
    public Map<String, Object> handler(Map<String, Object> event, Map<String, Object> context) {
        String name = event.getOrDefault("name", "World").toString();

        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 200);
        response.put("body", "Hello, " + name + "!");

        return response;
    }
}
```

### Testing Functions

Use the built-in test interface:

```json
{
  "name": "Alice",
  "message": "Test invocation"
}
```

### Invoking Functions

**Via HTTP:**
```bash
curl -X POST https://your-domain.com/api/functions/{uuid}/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Token your-api-token" \ # optional
  -d '{"key": "value"}' # optional
```

**Via Dashboard:**
Navigate to function details and click **Test** or **Invoke**.

### Managing Dependencies

Create dependency sets for reusable packages:

1. Go to **Dependencies**
2. Create new dependency set
3. Add packages (e.g., `requests==2.31.0`)
   - First field: enter name of dependency. (e.g., `requests`)
   - Second field: enter version of dependency. This is not required, and if left blank will auto-install the latest version. (e.g., `2.31.0`)
4. Attach to functions

**Note**: Dependency sets are supported for Python, Node.js, and Ruby runtimes only. Go, Java, .NET, and Bash runtimes do not support dependency management through the platform.

### Using Secrets

Secrets are **encrypted at rest** and injected into functions at during the function deployment.

Access environment variables and secrets in your functions:

**Python:**
```python
import os
secret = os.getenv('SECRET')
```

**Node.js:**
```javascript
const secret = process.env.SECRET
```

**Ruby:**
```ruby
secret = ENV['SECRET']
```

**Go:**
```go
import "os"
secret := os.Getenv("SECRET")
```

**Java:**
```java
String secret = System.getProperty("SECRET");
```

**.NET:**
```csharp
var secret = Environment.GetEnvironmentVariable("SECRET")
```

**Bash:**
```bash
secret=$SECRET
```

### Scheduled Triggers

Create cron-based triggers:

1. Navigate to function → **Triggers**
2. Add scheduled trigger
3. Select a pre-defined schedule or enter a custom cron expression (e.g., `0 */6 * * *` for every 6 hours)
4. Enable trigger

> **Note** Triggersassigned to a function are automatically disabled when a function is undeployed.

---

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Django 5.1 (REST API)
- Django Ninja (API framework)
- Celery (async task processing)
- PostgreSQL (database)
- Redis (cache & message broker)

**Frontend:**
- Next.js 15 (React framework)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Recharts (analytics)

**Infrastructure:**
- Kubernetes (kind)
- Docker & Docker Compose
- Traefik (reverse proxy)
- Nginx (reverse proxy)
- Metrics Server (autoscaling)

## 💻 Development

### Backend Development

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Run development server (first user to register will be admin)
python manage.py runserver
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Building Docker Images

**Backend:**
```bash
docker build -f Dockerfile.backend -t fnbox-backend:latest .
```

**Frontend:**
```bash
docker build \
  -f Dockerfile.frontend \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/ \
  --build-arg NEXT_PUBLIC_BASE_URL_ACCOUNTS=http://localhost:8000/ \
  -t fnbox-frontend:latest .
```

### Running Tests

**Backend:**
```bash
cd backend
python manage.py test
```

**Frontend:**
```bash
cd frontend
npm test
```

---

## 🔍 Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker compose logs fnbox-backend

# Check if ports are in use
sudo netstat -tlnp | grep :8000
```

**Database connection errors:**
```bash
# Verify postgres is healthy
docker compose ps fnbox-postgres

# Check postgres logs
docker compose logs fnbox-postgres

# Verify environment variables
docker compose exec fnbox-backend env | grep DB_
```

**Frontend can't connect to backend:**
```bash
# Check network connectivity
docker compose exec fnbox-frontend ping fnbox-backend

# Verify environment variables
docker compose exec fnbox-frontend env | grep NEXT_PUBLIC
```

**Kubernetes functions not deploying:**
```bash
# Check Kubernetes cluster status
kubectl get nodes

# Check namespace
kubectl get all -n fnbox-functions

# Check pod logs
kubectl logs <pod-name> -n fnbox-functions

# Verify metrics server
kubectl top nodes
```

### Useful Commands

```bash
# View all containers
docker compose ps

# Restart a service
docker compose restart fnbox-backend

# Execute commands in container
docker compose exec fnbox-backend python manage.py shell

# Access database
docker compose exec fnbox-postgres psql -U fnbox -d fnbox

# View Kubernetes resources
kubectl get all -n fnbox-functions
kubectl top pods -n fnbox-functions
kubectl get hpa -n fnbox-functions

# View function logs
kubectl logs <pod-name> -n fnbox-functions -f
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [Django](https://www.djangoproject.com/)
- [Next.js](https://nextjs.org/)
- [Kubernetes](https://kubernetes.io/)
- [Docker](https://www.docker.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

---

<div align="center">

**Made with ❤️ by the FnBox Team**

[⬆ Back to Top](#-fnbox---serverless-functions-platform)

</div>
