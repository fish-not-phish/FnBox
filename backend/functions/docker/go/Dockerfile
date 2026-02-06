# Go 1.25 runtime
FROM golang:1.25.7-alpine

# Install common utilities and build tools
RUN apk add --no-cache \
    curl \
    wget \
    git \
    ca-certificates \
    gcc \
    musl-dev

# Create app directory
WORKDIR /app

# Initialize Go module for agent
RUN go mod init agent

# Copy agent source
COPY go/agent.go /app/agent.go

# Download dependencies
RUN go get github.com/traefik/yaegi/interp@latest && \
    go get github.com/traefik/yaegi/stdlib@latest

# Build agent
RUN go build -o /app/agent agent.go

# Create non-root user
RUN adduser -D -u 1000 gouser && \
    chown -R gouser:gouser /app && \
    mkdir -p /tmp/go-functions && \
    chown -R gouser:gouser /tmp/go-functions

USER gouser

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8080/health || exit 1

# Run agent
CMD ["/app/agent"]
