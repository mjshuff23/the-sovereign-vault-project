FROM rust:1.95-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.toml
COPY src src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --create-home --uid 10001 sanitizer
WORKDIR /app
COPY --from=builder --chown=sanitizer:sanitizer /app/target/release/sovereign-sanitizer /usr/local/bin/sovereign-sanitizer
ENV PORT=8080
EXPOSE 8080
USER sanitizer
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1
CMD ["sovereign-sanitizer"]
