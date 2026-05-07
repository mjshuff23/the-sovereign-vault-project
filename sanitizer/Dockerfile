FROM rust:1.95-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.toml
COPY src src
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/sovereign-sanitizer /usr/local/bin/sovereign-sanitizer
ENV PORT=8080
EXPOSE 8080
CMD ["sovereign-sanitizer"]
