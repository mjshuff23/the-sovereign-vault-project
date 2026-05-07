FROM python:3.12-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --create-home --uid 10001 vaultapp
WORKDIR /app
COPY --chown=vaultapp:vaultapp requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=vaultapp:vaultapp app app
ENV PYTHONPATH=/app
USER vaultapp
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
