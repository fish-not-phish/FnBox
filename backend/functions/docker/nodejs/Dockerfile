# Node.js runtime
ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-slim

# Install common packages
RUN npm install -g \
    axios \
    aws-sdk \
    pg \
    redis \
    mongodb

# Copy agent
COPY nodejs/agent.js /app/agent.js

WORKDIR /app

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Run agent
CMD ["node", "/app/agent.js"]
