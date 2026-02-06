# Multi-stage build for Python runtimes
ARG PYTHON_VERSION=3.11

FROM python:${PYTHON_VERSION}-slim

# Install common packages
RUN pip install --no-cache-dir \
    requests \
    urllib3 \
    boto3 \
    psycopg2-binary \
    redis \
    pymongo

# Copy agent
COPY agent.py /app/agent.py

WORKDIR /app

# Create directory for function code
RUN mkdir -p /app/functions

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

# Run agent
CMD ["python", "/app/agent.py"]
