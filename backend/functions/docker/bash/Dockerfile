# Bash 5 runtime
FROM bash:5.2.37

# Install common utilities and networking tools
RUN apk add --no-cache \
    curl \
    wget \
    jq \
    netcat-openbsd \
    socat \
    ca-certificates \
    coreutils \
    grep \
    sed

# Create app directory
WORKDIR /app

# Copy agent
COPY bash/agent.sh /app/agent.sh
RUN chmod +x /app/agent.sh

# Create non-root user
RUN adduser -D -u 1000 bashuser && \
    chown -R bashuser:bashuser /app && \
    mkdir -p /tmp/bash-functions && \
    chown -R bashuser:bashuser /tmp/bash-functions

USER bashuser

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run agent
CMD ["/app/agent.sh"]
