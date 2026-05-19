FROM python:3.11-slim

# Security: run as non-root
RUN useradd --create-home --shell /bin/bash karma
WORKDIR /app

# Install system deps needed for some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer cache)
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

# Copy application code
COPY karma/ karma/

RUN chown -R karma:karma /app
USER karma

EXPOSE 8080

# ADK serves the AdkApp over HTTP when run as a module
CMD ["python", "-m", "google.adk.cli", "api_server", "karma.app:app", \
     "--host", "0.0.0.0", "--port", "8080"]
