"""
Claude Vision fallback. Last-resort HTML extractor when:
  - HTML parse yields < 3 fields, OR
  - parser raises `ParseError`

Trigger from `BaseScraper.run()`. NOT used for primary scraping — Vision is
expensive and slow.

Per CLAUDE.md IP firewall: strip signal weights / scoring metadata before
sending prompts to Anthropic. Prompts here only contain the screenshot + a
schema-prescribed extraction request.
"""

from __future__ import annotations

import base64
import json

import structlog
from anthropic import AsyncAnthropic

from app.config import get_settings

log = structlog.get_logger()


class VisionExtractError(Exception):
    """Vision call returned unparseable JSON or refused the extraction."""


# Default property-page extraction schema. Subclass scrapers can override the
# `fields` list via `vision_extract(prompt_override=...)` if their target page
# has a different shape (e.g. recorder document list vs. assessor property page).
_DEFAULT_FIELDS = [
    "parcel_id",
    "owner_name",
    "owner_mailing_address",
    "address",
    "year_built",
    "sq_ft",
    "lot_sq_ft",
    "bedrooms",
    "bathrooms",
    "assessed_value",
    "tax_annual",
    "last_sale_date",
    "last_sale_price",
    "last_sale_deed_type",
]


def _build_prompt(fields: list[str]) -> str:
    field_list = ", ".join(fields)
    return (
        "Extract all property record fields from this county assessor screenshot. "
        "Return ONLY a JSON object — no prose, no markdown fence — with these fields: "
        f"{field_list}. Use null for any field not visible. "
        "Dates as YYYY-MM-DD. Money values as plain integers in dollars (not cents). "
        "Do not infer; if uncertain, return null."
    )


async def vision_extract(
    screenshot_bytes: bytes,
    *,
    fields: list[str] | None = None,
    prompt_override: str | None = None,
) -> dict:
    """Extract structured fields from a page screenshot via Claude Sonnet 4."""
    settings = get_settings()
    api_key = settings.anthropic_api_key.get_secret_value()
    if not api_key:
        raise VisionExtractError("ANTHROPIC_API_KEY not configured")

    fields = fields or _DEFAULT_FIELDS
    prompt = prompt_override or _build_prompt(fields)
    image_b64 = base64.b64encode(screenshot_bytes).decode("ascii")

    client = AsyncAnthropic(api_key=api_key)
    resp = await client.messages.create(
        model=settings.anthropic_vision_model,
        max_tokens=settings.vision_max_tokens,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    if not resp.content or resp.content[0].type != "text":
        raise VisionExtractError("vision response empty or non-text")

    raw_text = resp.content[0].text.strip()
    # Strip stray markdown fences if the model misbehaves
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").lstrip("json").strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        log.error("vision.json_decode_failed", excerpt=raw_text[:300])
        raise VisionExtractError(f"vision returned non-JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise VisionExtractError(f"vision returned non-object: {type(data).__name__}")

    return data
