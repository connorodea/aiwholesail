# OffMarketIQ — single image used by api, worker, beat.
# Python 3.12 slim base. Installs all deps + project, exposes 8000 for the API.
# Workers + beat override the CMD via docker-compose.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps: libpq for psycopg2-binary's runtime, libxml2 for lxml, ca-certs
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      libxml2-dev \
      libxslt-dev \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifest first for layer caching
COPY pyproject.toml ./
RUN pip install --upgrade pip setuptools wheel \
    && pip install -e .[dev]

# Copy the rest of the project
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
