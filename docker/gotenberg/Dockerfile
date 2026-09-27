# ADR-010 — Gotenberg with Noto Sans baked in.
# Without it, ₹ can render as an empty box on every quotation and invoice, silently.
# CI gate 7 (tests/integration/rupee-pdf.test.ts) builds this image and asserts the glyph renders.
FROM gotenberg/gotenberg:8

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-core \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f
USER gotenberg
