# Java 27 runtime
FROM openjdk:27-ea-slim-bookworm

# Install common HTTP libraries and utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Download common Java libraries (JSON processing, HTTP client)
RUN mkdir -p /app/lib && \
    cd /app/lib && \
    curl -L -o json.jar https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar && \
    curl -L -o okhttp.jar https://repo1.maven.org/maven2/com/squareup/okhttp3/okhttp/4.12.0/okhttp-4.12.0.jar && \
    curl -L -o okio.jar https://repo1.maven.org/maven2/com/squareup/okio/okio/3.6.0/okio-3.6.0.jar && \
    curl -L -o okio-jvm.jar https://repo1.maven.org/maven2/com/squareup/okio/okio-jvm/3.6.0/okio-jvm-3.6.0.jar && \
    curl -L -o kotlin-stdlib.jar https://repo1.maven.org/maven2/org/jetbrains/kotlin/kotlin-stdlib/1.9.20/kotlin-stdlib-1.9.20.jar

# Copy agent
COPY java/agent.java /app/agent.java

# Compile agent with dependencies
RUN javac -cp "/app/lib/*" -d /app /app/agent.java

# Create non-root user
RUN useradd -u 1000 -m -s /bin/bash javauser && \
    chown -R javauser:javauser /app && \
    mkdir -p /tmp/java-functions && \
    chown -R javauser:javauser /tmp/java-functions

USER javauser

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run agent
CMD ["java", "-cp", "/app:/app/lib/*", "agent"]
