# OffMarketIQ — common dev targets. All commands assume Docker Compose is available.

.PHONY: help up down logs build dev migrate revision shell test test-unit test-integration lint format scrape score bootstrap

help:
	@echo "OffMarketIQ — Make targets:"
	@echo "  make up                  start the full stack (api + worker + beat + postgres + redis)"
	@echo "  make down                stop and remove containers (keeps volumes)"
	@echo "  make logs [s=api]        tail logs (one service or all)"
	@echo "  make build               rebuild images (after pyproject.toml changes)"
	@echo "  make dev                 up + tail api logs"
	@echo "  make migrate             apply alembic migrations"
	@echo "  make revision m='msg'    autogenerate a new alembic revision"
	@echo "  make shell s=api         exec a shell into a running container"
	@echo "  make test                full pytest suite"
	@echo "  make test-unit           unit tests only"
	@echo "  make test-integration    integration tests (needs stack up)"
	@echo "  make lint                ruff check"
	@echo "  make format              ruff format + isort imports"
	@echo "  make bootstrap           seed county registry with priority counties"
	@echo "  make scrape c=04013      ad-hoc scrape one county FIPS (assessor)"
	@echo "  make score               trigger a manual rescore of all properties"

up:
	docker compose up -d

down:
	docker compose down

logs:
	@if [ -n "$(s)" ]; then docker compose logs -f $(s); else docker compose logs -f; fi

build:
	docker compose build

dev: up
	docker compose logs -f api

migrate:
	docker compose run --rm api alembic upgrade head

revision:
	@if [ -z "$(m)" ]; then echo "Usage: make revision m='describe change'"; exit 1; fi
	docker compose run --rm api alembic revision --autogenerate -m "$(m)"

shell:
	@s=$${s:-api}; docker compose exec $$s /bin/bash

test:
	docker compose run --rm api pytest

test-unit:
	docker compose run --rm api pytest -m unit

test-integration:
	docker compose run --rm api pytest -m integration

lint:
	docker compose run --rm api ruff check .

format:
	docker compose run --rm api ruff format .
	docker compose run --rm api ruff check --fix .

bootstrap:
	docker compose run --rm api python scripts/bootstrap_counties.py

scrape:
	@if [ -z "$(c)" ]; then echo "Usage: make scrape c=<fips_code>"; exit 1; fi
	docker compose run --rm api python -c "from app.tasks.scrape_tasks import scrape_county_assessor; scrape_county_assessor.delay('$(c)')"

score:
	docker compose run --rm api python -c "from app.tasks.etl_tasks import refresh_all_scores; refresh_all_scores.delay()"
