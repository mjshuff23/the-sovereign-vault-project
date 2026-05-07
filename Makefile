SHELL := /bin/bash
NPM ?= npm
PYTHON ?= python3

# Local-development attestation HMAC key. Override in CI/prod by exporting
# ATTESTATION_SECRET in the environment. Both the seed step and the vault
# tests refuse to run without it (fail-closed).
ATTESTATION_SECRET ?= local-dev-attestation-secret
export ATTESTATION_SECRET

.PHONY: build seed up test down vault-deps vault-test-deps

vault/.venv/bin/python:
	$(PYTHON) -m venv vault/.venv
	vault/.venv/bin/pip install -r vault/requirements.txt

vault-deps: vault/.venv/bin/python

vault-test-deps: vault/.venv/bin/python
	vault/.venv/bin/pip install -r vault/requirements-test.txt

build: vault-deps
	$(NPM) install
	$(NPM) run build -w worker
	$(NPM) run build -w frontend
	cargo build --manifest-path sanitizer/Cargo.toml
	docker compose build sanitizer vault worker frontend

seed:
	docker compose up -d --wait redis qdrant
	node scripts/attestation/generate.mjs
	node scripts/seed-qdrant.mjs

up: seed
	docker compose up --build

test: vault-test-deps
	$(NPM) run test -w worker
	$(NPM) run test -w frontend
	cargo test --manifest-path sanitizer/Cargo.toml
	cd vault && .venv/bin/python -m pytest

down:
	docker compose down --remove-orphans
