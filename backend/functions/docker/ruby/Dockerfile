# Ruby 3.4 runtime
FROM ruby:3.4-slim

# Install common utilities and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install common gems
RUN gem install webrick httparty pg redis mongo

# Create app directory
WORKDIR /app

# Copy agent
COPY ruby/agent.rb /app/agent.rb
RUN chmod +x /app/agent.rb

# Create non-root user
RUN useradd -u 1000 -m -s /bin/bash rubyuser && \
    chown -R rubyuser:rubyuser /app && \
    mkdir -p /tmp/ruby-functions && \
    chown -R rubyuser:rubyuser /tmp/ruby-functions

USER rubyuser

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run agent
CMD ["ruby", "/app/agent.rb"]
