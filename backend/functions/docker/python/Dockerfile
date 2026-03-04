# Multi-stage build for Python runtimes
ARG PYTHON_VERSION=3.11

FROM python:${PYTHON_VERSION}-slim

# Install common packages and SSH client
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    requests \
    urllib3 \
    boto3 \
    psycopg2-binary \
    redis \
    pymongo

# Create a non-root user with UID 1000 (matches Kubernetes runAsUser)
# This is required for SSH to work - it looks up the user by UID
RUN groupadd -g 1000 app && \
    useradd -m -u 1000 -g 1000 -s /bin/bash app

# Copy agent
COPY agent.py /app/agent.py

WORKDIR /app

# Create directory for function code
RUN mkdir -p /app/functions

# Create .ssh directory for SSH keys (if mounted)
RUN mkdir -p /app/.ssh && chown -R app:app /app/.ssh

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

# Run as non-root user (matches Kubernetes runAsUser: 1000)
USER 1000:1000

# Run agent
CMD ["python", "/app/agent.py"]
