#!/usr/bin/env python3
"""Collect starter wedding venue research into a CSV.

This is a research assistant, not an autopublisher. It gathers public starter
facts so every row can be reviewed before being entered into the admin CMS.

Discovery mode uses Google Places Text Search (New) when GOOGLE_PLACES_API_KEY
or GOOGLE_MAPS_API_KEY is available.

Website mode crawls only URLs you explicitly provide and extracts obvious
contact details from the page and first contact/enquiry page it finds.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
import sys
import time
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


DEFAULT_COLUMNS = [
    "research_status",
    "venue_name",
    "website",
    "contact_email",
    "phone",
    "contact_page",
    "town",
    "region",
    "address",
    "venue_type_guess",
    "google_maps_url",
    "source",
    "source_url",
    "confidence",
    "notes",
]

CONTACT_LINK_HINTS = ("contact", "enquiry", "enquire", "wedding", "venue-hire", "events")
EMAIL_RE = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}(?![\w.-])")
PHONE_RE = re.compile(
    r"(?:(?:\+44\s?|0)(?:\(?\d{2,5}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4})"
)


@dataclass
class VenueLead:
    research_status: str = "Needs review"
    venue_name: str = ""
    website: str = ""
    contact_email: str = ""
    phone: str = ""
    contact_page: str = ""
    town: str = ""
    region: str = ""
    address: str = ""
    venue_type_guess: str = ""
    google_maps_url: str = ""
    source: str = ""
    source_url: str = ""
    confidence: str = "Low"
    notes: str = ""


class BasicPageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title_parts: list[str] = []
        self.in_title = False
        self.links: list[tuple[str, str]] = []
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "title":
            self.in_title = True
        if tag.lower() == "a":
            href = attrs_dict.get("href", "")
            text = attrs_dict.get("aria-label", "") or attrs_dict.get("title", "")
            if href:
                self.links.append((href, text))
        if tag.lower() == "meta":
            key = attrs_dict.get("property") or attrs_dict.get("name")
            content = attrs_dict.get("content")
            if key and content:
                self.meta[key.lower()] = content

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data.strip())

    @property
    def title(self) -> str:
        return html.unescape(" ".join(part for part in self.title_parts if part)).strip()


def fetch_url(url: str, timeout: int = 12) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "EverAfterResearchBot/0.1 (+manual research; contact via site owner)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            return ""
        raw = response.read(2_000_000)
    return raw.decode("utf-8", errors="replace")


def normalize_url(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if not re.match(r"^https?://", value, flags=re.I):
        value = f"https://{value}"
    return value


def normalize_phone(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def first_unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        cleaned = value.strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            output.append(cleaned)
    return output


def infer_type(name_or_text: str) -> str:
    text = name_or_text.lower()
    if "castle" in text:
        return "Castle"
    if "barn" in text or "farm" in text:
        return "Barn"
    if "hotel" in text or "resort" in text:
        return "Luxury Hotel"
    if "estate" in text or "house" in text or "hall" in text:
        return "Country Estate"
    return ""


def title_to_name(parser: BasicPageParser, fallback_url: str) -> str:
    for key in ("og:site_name", "og:title", "twitter:title"):
        value = parser.meta.get(key, "").strip()
        if value:
            return value.split("|")[0].split(" - ")[0].strip()
    if parser.title:
        return parser.title.split("|")[0].split(" - ")[0].strip()
    host = urlparse(fallback_url).netloc.replace("www.", "")
    return host.split(".")[0].replace("-", " ").title()


def extract_contact_links(parser: BasicPageParser, base_url: str) -> list[str]:
    candidates: list[str] = []
    for href, text in parser.links:
        lowered = f"{href} {text}".lower()
        if href.lower().startswith("mailto:") or href.lower().startswith("tel:"):
            continue
        if any(hint in lowered for hint in CONTACT_LINK_HINTS):
            absolute = urljoin(base_url, href)
            parsed = urlparse(absolute)
            if parsed.scheme in {"http", "https"} and parsed.netloc == urlparse(base_url).netloc:
                candidates.append(absolute)
    return first_unique(candidates)[:3]


def extract_from_html(page_html: str) -> tuple[list[str], list[str], BasicPageParser]:
    parser = BasicPageParser()
    parser.feed(page_html)

    mailto_emails = [
        href.removeprefix("mailto:").split("?")[0]
        for href, _ in parser.links
        if href.lower().startswith("mailto:")
    ]
    text_emails = EMAIL_RE.findall(page_html)
    tel_numbers = [
        href.removeprefix("tel:")
        for href, _ in parser.links
        if href.lower().startswith("tel:")
    ]
    text_numbers = PHONE_RE.findall(page_html)

    emails = first_unique([*mailto_emails, *text_emails])
    phones = first_unique([*(normalize_phone(phone) for phone in tel_numbers), *(normalize_phone(phone) for phone in text_numbers)])
    return emails, phones, parser


def crawl_website(url: str) -> VenueLead:
    url = normalize_url(url)
    lead = VenueLead(website=url, source="website", source_url=url)
    try:
        page_html = fetch_url(url)
    except (HTTPError, URLError, TimeoutError) as error:
        lead.notes = f"Could not fetch homepage: {error}"
        return lead

    emails, phones, parser = extract_from_html(page_html)
    lead.venue_name = title_to_name(parser, url)
    lead.venue_type_guess = infer_type(f"{lead.venue_name} {page_html[:2000]}")
    lead.contact_email = emails[0] if emails else ""
    lead.phone = phones[0] if phones else ""

    contact_links = extract_contact_links(parser, url)
    lead.contact_page = contact_links[0] if contact_links else ""

    if contact_links and (not lead.contact_email or not lead.phone):
        try:
            contact_html = fetch_url(contact_links[0])
            contact_emails, contact_phones, _ = extract_from_html(contact_html)
            lead.contact_email = lead.contact_email or (contact_emails[0] if contact_emails else "")
            lead.phone = lead.phone or (contact_phones[0] if contact_phones else "")
        except (HTTPError, URLError, TimeoutError) as error:
            lead.notes = f"Homepage fetched; contact page failed: {error}"

    lead.confidence = "High" if lead.contact_email or lead.phone else "Medium"
    if not lead.notes:
        lead.notes = "Review manually before adding to admin."
    return lead


def google_text_search(query: str, api_key: str, limit: int, region_code: str = "GB") -> list[VenueLead]:
    endpoint = "https://places.googleapis.com/v1/places:searchText"
    field_mask = ",".join(
        [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.addressComponents",
            "places.location",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.websiteUri",
            "places.googleMapsUri",
            "places.types",
            "places.businessStatus",
            "nextPageToken",
        ]
    )
    leads: list[VenueLead] = []
    page_token = ""

    while len(leads) < limit:
        payload = {
            "textQuery": query,
            "regionCode": region_code,
            "pageSize": min(20, max(1, limit - len(leads))),
        }
        if page_token:
            payload["pageToken"] = page_token

        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": field_mask,
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=20) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Google Places request failed: {error.code} {details}") from error
        except (URLError, TimeoutError) as error:
            raise RuntimeError(f"Google Places request failed: {error}") from error

        for place in body.get("places", []):
            lead = place_to_lead(place, query)
            leads.append(lead)
            if len(leads) >= limit:
                break

        page_token = body.get("nextPageToken", "")
        if not page_token:
            break
        time.sleep(2)

    return leads


def place_to_lead(place: dict, query: str) -> VenueLead:
    address = place.get("formattedAddress", "")
    website = place.get("websiteUri", "")
    phone = place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber") or ""
    display = place.get("displayName") or {}
    name = display.get("text", "")
    town, region = town_region_from_components(place.get("addressComponents", []))
    types = " ".join(place.get("types", []))

    notes = "Review manually before adding to admin."
    if place.get("businessStatus") and place.get("businessStatus") != "OPERATIONAL":
        notes = f"Business status from Google: {place.get('businessStatus')}. Review carefully."

    return VenueLead(
        venue_name=name,
        website=website,
        phone=phone,
        town=town,
        region=region,
        address=address,
        venue_type_guess=infer_type(f"{name} {types}"),
        google_maps_url=place.get("googleMapsUri", ""),
        source="google_places",
        source_url=query,
        confidence="High" if website and phone else "Medium" if website or phone else "Low",
        notes=notes,
    )


def town_region_from_components(components: list[dict]) -> tuple[str, str]:
    town = ""
    region = ""
    for component in components:
        types = set(component.get("types", []))
        name = component.get("longText") or component.get("shortText") or ""
        if not town and types.intersection({"postal_town", "locality"}):
            town = name
        if not region and types.intersection({"administrative_area_level_2", "administrative_area_level_1"}):
            region = name
    return town, region


def dedupe(leads: Iterable[VenueLead]) -> list[VenueLead]:
    seen: set[str] = set()
    output: list[VenueLead] = []
    for lead in leads:
        parsed = urlparse(lead.website)
        key = parsed.netloc.lower().removeprefix("www.") if parsed.netloc else lead.venue_name.lower()
        if not key:
            key = f"{lead.source}:{lead.source_url}"
        if key in seen:
            continue
        seen.add(key)
        output.append(lead)
    return output


def write_csv(leads: list[VenueLead], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=DEFAULT_COLUMNS)
        writer.writeheader()
        for lead in leads:
            writer.writerow(asdict(lead))


def read_urls_file(path: Path) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(path)
    urls: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            urls.append(line)
    return urls


def load_env_file(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect starter wedding venue research into a CSV.")
    parser.add_argument("--query", action="append", default=[], help="Google Places query. Can be repeated.")
    parser.add_argument("--limit", type=int, default=20, help="Maximum Google Places results per query.")
    parser.add_argument("--region-code", default="GB", help="Google Places region code. Default: GB.")
    parser.add_argument("--url", action="append", default=[], help="Venue website URL to crawl. Can be repeated.")
    parser.add_argument("--urls-file", type=Path, help="Text file containing one venue website URL per line.")
    parser.add_argument("--output", type=Path, default=Path("outputs/venue_research/venue_research.csv"))
    return parser.parse_args()


def main() -> int:
    load_env_file()
    args = parse_args()
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    leads: list[VenueLead] = []

    if args.query and not api_key:
        print(
            "ERROR: --query requires GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY in your environment.",
            file=sys.stderr,
        )
        return 2

    for query in args.query:
        print(f"Searching Google Places: {query}", file=sys.stderr)
        leads.extend(google_text_search(query, api_key=api_key, limit=args.limit, region_code=args.region_code))

    urls = list(args.url)
    if args.urls_file:
        urls.extend(read_urls_file(args.urls_file))

    for url in urls:
        print(f"Crawling website: {url}", file=sys.stderr)
        leads.append(crawl_website(url))
        time.sleep(0.5)

    leads = dedupe(leads)
    write_csv(leads, args.output)
    print(f"Wrote {len(leads)} venue leads to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
