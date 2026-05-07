from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor


def configure_tracing() -> None:
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    provider = TracerProvider(resource=Resource.create({"service.name": "sovereign-vault"}))
    if endpoint:
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
    trace.set_tracer_provider(provider)
