# Node.js runtime
ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-slim

# Install common packages and SSH client
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
    axios \
    aws-sdk \
    pg \
    redis \
    mongodb

# Create a non-root user with UID 1000 (matches Kubernetes runAsUser)
RUN groupadd -g 1000 app && \
    useradd -m -u 1000 -g 1000 -s /bin/bash app

# Copy agent
COPY nodejs/agent.js /app/agent.js

WORKDIR /app

# Create .ssh directory for SSH keys (if mounted)
RUN mkdir -p /app/.ssh && chown -R app:app /app/.ssh

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Run as non-root user (matches Kubernetes runAsUser: 1000)
USER 1000:1000

# Run agent
CMD ["node", "/app/agent.js"]
