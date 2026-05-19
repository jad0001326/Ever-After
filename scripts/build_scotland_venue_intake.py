#!/usr/bin/env python3
"""Build an import-ready EverAft venue intake CSV for Scotland discovery batches."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXCLUDE_CSV = ROOT / "outputs" / "venue_intake" / "ever_after_venue_intake_filled.csv"
DEFAULT_OUTPUT = ROOT / "outputs" / "venue_intake" / "scotland_batch_001_import_ready.csv"
DEFAULT_REPORT = ROOT / "outputs" / "venue_intake" / "scotland_batch_001_report.csv"

HEADERS = [
    "Research status",
    "Publish status",
    "Priority",
    "Venue name",
    "Slug",
    "Type",
    "Town",
    "Region",
    "Address",
    "Summary",
    "Description",
    "Price from",
    "Price to",
    "Capacity min",
    "Capacity max",
    "Hero image URL",
    "Amenities",
    "Featured?",
    "Latitude",
    "Longitude",
    "Contact Number",
    "Official website/source",
    "Image source/permission notes",
    "Missing info / notes",
    "Official website URL",
    "Official gallery URL",
    "Vendor contact email",
    "Listing status",
    "Claim status",
    "Image permission status",
    "Image credit",
    "Image is representative?",
    "Is claimed?",
    "Claimant name",
    "Claimant email",
    "Claimant role",
    "Business email",
    "Business phone",
    "Evidence URL",
    "Invite status",
    "Invite sent at",
    "Claim admin notes",
    "Founding partner notes",
]

QUERY_PRESETS = [
    "wedding venues Scotland",
    "castle wedding venues Scotland",
    "barn wedding venues Scotland",
    "country estate wedding venues Scotland",
    "luxury hotel wedding venues Scotland",
    "wedding venues Edinburgh Scotland",
    "wedding venues Glasgow Scotland",
    "wedding venues Fife Scotland",
    "wedding venues Perthshire Scotland",
    "wedding venues Aberdeenshire Scotland",
    "wedding venues Highlands Scotland",
    "wedding venues Scottish Borders",
    "wedding venues Ayrshire Scotland",
    "wedding venues Dumfries and Galloway Scotland",
    "wedding venues Stirling Scotland",
    "wedding venues Loch Lomond Scotland",
    "wedding venues Argyll Scotland",
    "wedding venues Inverness Scotland",
    "wedding venues Dundee Scotland",
    "wedding venues Angus Scotland",
    "wedding venues Moray Scotland",
    "wedding venues Lanarkshire Scotland",
    "wedding venues Aberdeen Scotland",
]

AMENITY_HINTS = [
    ("Exclusive use", ("exclusive use", "exclusive hire", "exclusively yours", "private hire")),
    ("Guest accommodation", ("accommodation", "bedrooms", "sleeps", "rooms", "lodges", "cottages", "cabins")),
    ("Licensed ceremony spaces", ("licensed", "civil ceremony", "ceremony licence", "licensed ceremony", "ceremonies")),
    ("In-house catering", ("in-house catering", "catering", "menu", "chef", "dining")),
    ("Landscaped gardens", ("garden", "gardens", "grounds", "lawn", "courtyard", "woodland")),
    ("Pet friendly", ("dog friendly", "pet friendly", "dogs welcome", "pets")),
    ("Private parking", ("parking", "car park", "private parking")),
    ("Late licence", ("late licence", "late license", "midnight", "1am", "bar until")),
]

TYPE_HINTS = [
    ("Castle", ("castle",)),
    ("Barn", ("barn", "steading", "farm")),
    ("Luxury Hotel", ("hotel", "resort", "spa")),
    ("Country Estate", ("estate", "house", "hall", "garden", "chapel", "club", "venue")),
]

GALLERY_TERMS = ("gallery", "galleries", "photo", "photos", "images", "virtual-tour", "tour", "real-wedding", "real-weddings")
WEDDING_TERMS = ("wedding", "weddings", "ceremony", "celebrations", "venue-hire", "events", "private-hire")
CONTACT_TERMS = ("contact", "enquiry", "enquire", "book", "brochure", "prices", "pricing")
COMMON_PATHS = (
    "/weddings/",
    "/wedding/",
    "/wedding-venue/",
    "/wedding-events/",
    "/events/weddings/",
    "/gallery/",
    "/galleries/",
    "/wedding-gallery/",
    "/weddings/gallery/",
)

EMAIL_RE = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}(?![\w.-])")
PHONE_RE = re.compile(r"(?:(?:\+44\s?|0)(?:\(?\d{2,5}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4})")
PRICE_RE = re.compile(r"£\s?([1-9]\d{2,5})(?:[,.](\d{3}))?")
CAPACITY_PATTERNS = (
    re.compile(r"(?:up to|capacity of|seats?|seat|guests?|standing|dining)[^\d]{0,20}(\d{2,3})", re.I),
    re.compile(r"(\d{2,3})\s*(?:day|evening|wedding)?\s*guests?", re.I),
)


@dataclass
class Candidate:
    place_id: str
    name: str
    website: str
    phone: str
    address: str
    town: str
    region: str
    latitude: str
    longitude: str
    maps_url: str
    type_guess: str
    source_query: str
    business_status: str


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attrs_dict = {key.lower(): value or "" for key, value in attrs}
        href = attrs_dict.get("href", "")
        if href:
            self._href = href
            self._text = [attrs_dict.get("aria-label", ""), attrs_dict.get("title", "")]

    def handle_data(self, data: str) -> None:
        if self._href:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            self.links.append((self._href, clean_text(" ".join(self._text))[:160]))
            self._href = None
            self._text = []


def clean_text(value: str) -> str:
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = value.replace("&amp;", "&").replace("&nbsp;", " ")
    value = value.replace("&#8217;", "'").replace("&rsquo;", "'")
    value = value.replace("&#8211;", "-").replace("&ndash;", "-")
    return re.sub(r"\s+", " ", value).strip()


def load_env(path: Path = ROOT / ".env") -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def fetch(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None, timeout: int = 18) -> tuple[str, str]:
    request = Request(
        url,
        data=data,
        headers={
            "User-Agent": "EverAfterVenueResearch/0.3 (+manual launch research)",
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
            **(headers or {}),
        },
        method="POST" if data else "GET",
    )
    with urlopen(request, timeout=timeout) as response:
        body = response.read(2_000_000).decode("utf-8", errors="replace")
        return body, response.url


def google_text_search(query: str, api_key: str, limit: int) -> list[Candidate]:
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
    leads: list[Candidate] = []
    token = ""
    while len(leads) < limit:
        payload: dict[str, object] = {
            "textQuery": query,
            "regionCode": "GB",
            "pageSize": min(20, limit - len(leads)),
        }
        if token:
            payload["pageToken"] = token
        body, _ = fetch(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": field_mask,
            },
            timeout=18,
        )
        parsed = json.loads(body)
        for place in parsed.get("places", []):
            leads.append(place_to_candidate(place, query))
            if len(leads) >= limit:
                break
        token = parsed.get("nextPageToken", "")
        if not token:
            break
        time.sleep(2)
    return leads


def place_to_candidate(place: dict, query: str) -> Candidate:
    display = place.get("displayName") or {}
    town, region = town_region(place.get("addressComponents", []))
    location = place.get("location") or {}
    name = display.get("text", "")
    types_text = " ".join(place.get("types", []))
    return Candidate(
        place_id=place.get("id", ""),
        name=name,
        website=place.get("websiteUri", ""),
        phone=place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber") or "",
        address=place.get("formattedAddress", ""),
        town=town,
        region=region,
        latitude=str(location.get("latitude", "")),
        longitude=str(location.get("longitude", "")),
        maps_url=place.get("googleMapsUri", ""),
        type_guess=infer_type(f"{name} {types_text}"),
        source_query=query,
        business_status=place.get("businessStatus", ""),
    )


def town_region(components: list[dict]) -> tuple[str, str]:
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


def normalize_url(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if not re.match(r"^https?://", value, flags=re.I):
        value = f"https://{value}"
    try:
        parsed = urlparse(value)
        return parsed._replace(fragment="").geturl()
    except ValueError:
        return value


def same_host(url: str, base: str) -> bool:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    base_host = urlparse(base).netloc.lower().removeprefix("www.")
    return bool(host and base_host and (host == base_host or host.endswith(f".{base_host}")))


def extract_links(html: str, base_url: str) -> list[tuple[str, str]]:
    parser = LinkParser()
    parser.feed(html)
    seen: set[str] = set()
    output: list[tuple[str, str]] = []
    for href, text in parser.links:
        href = href.strip().strip("\"'\\")
        if href.startswith("#") or href.lower().startswith(("javascript:", "mailto:", "tel:")):
            continue
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.scheme not in {"http", "https"}:
            continue
        if re.search(r"\.(jpe?g|png|webp|gif|svg|pdf|zip|mp4|mov|webm)(?:$|\?)", parsed.path, re.I):
            continue
        absolute = parsed._replace(fragment="").geturl()
        if not same_host(absolute, base_url):
            continue
        key = absolute.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append((absolute, text))
    return output


def link_score(link: tuple[str, str], terms: Iterable[str]) -> int:
    haystack = f"{link[0]} {link[1]}".lower()
    return sum(1 for term in terms if term in haystack)


def extract_emails(html: str) -> list[str]:
    emails = EMAIL_RE.findall(html)
    seen: set[str] = set()
    output: list[str] = []
    for email in emails:
        clean = email.strip()
        lower = clean.lower()
        if lower in seen:
            continue
        if re.search(r"example|domain|privacy|sentry|wixpress|wordpress|schema|email@|\.(png|jpe?g|webp|gif|svg)$", lower):
            continue
        seen.add(lower)
        output.append(clean)
    return output[:3]


def extract_phones(html: str) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for phone in PHONE_RE.findall(clean_text(html)):
        clean = re.sub(r"\s+", " ", phone).strip()
        if clean in seen:
            continue
        seen.add(clean)
        output.append(clean)
    return output[:3]


def infer_type(text: str) -> str:
    haystack = text.lower()
    for venue_type, hints in TYPE_HINTS:
        if any(hint in haystack for hint in hints):
            return venue_type
    return "Country Estate"


def infer_amenities(text: str) -> str:
    haystack = text.lower()
    values = [name for name, hints in AMENITY_HINTS if any(hint in haystack for hint in hints)]
    return ", ".join(values)


def extract_price(text: str) -> int:
    values: list[int] = []
    for match in PRICE_RE.finditer(text):
        value = int(f"{match.group(1)}{match.group(2) or ''}")
        if 500 <= value <= 100000:
            values.append(value)
    return min(values) if values else 0


def extract_capacity(text: str) -> int:
    values: list[int] = []
    for pattern in CAPACITY_PATTERNS:
        for match in pattern.finditer(text):
            value = int(match.group(1))
            if 20 <= value <= 500:
                values.append(value)
    return max(values) if values else 120


def choose_gallery_or_wedding(base_url: str, pages: list[tuple[str, str, list[tuple[str, str]]]]) -> tuple[str, str]:
    links: list[tuple[str, str]] = []
    seen: set[str] = set()
    for _, _, page_links in pages:
        for link in page_links:
            if link[0].lower() not in seen:
                seen.add(link[0].lower())
                links.append(link)
    gallery = [
        link for link in links
        if link_score(link, GALLERY_TERMS) > 0 and (link_score(link, WEDDING_TERMS) > 0 or re.search(r"gallery|galleries", f"{link[0]} {link[1]}", re.I))
    ]
    if gallery:
        gallery.sort(key=lambda link: link_score(link, GALLERY_TERMS) * 2 + link_score(link, WEDDING_TERMS), reverse=True)
        return gallery[0][0], "gallery"
    wedding = [link for link in links if link_score(link, WEDDING_TERMS) > 0]
    if wedding:
        wedding.sort(key=lambda link: link_score(link, WEDDING_TERMS), reverse=True)
        return wedding[0][0], "wedding_section"
    return base_url, "homepage_fallback"


def enrich_website(candidate: Candidate) -> dict[str, object]:
    website = normalize_url(candidate.website)
    if not website:
        return {"website": "", "gallery_url": "", "link_kind": "missing", "email": "", "phone": "", "text": "", "notes": "No official website from Google Places."}
    try:
        home_html, final_url = fetch(website, timeout=15)
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        return {"website": website, "gallery_url": website, "link_kind": "homepage_fallback", "email": "", "phone": "", "text": "", "notes": f"Could not fetch official website: {error}"}
    home_links = extract_links(home_html, final_url)
    candidates = sorted(
        [link for link in home_links if link_score(link, (*GALLERY_TERMS, *WEDDING_TERMS, *CONTACT_TERMS))],
        key=lambda link: link_score(link, (*GALLERY_TERMS, *WEDDING_TERMS, *CONTACT_TERMS)),
        reverse=True,
    )[:4]
    for path in COMMON_PATHS:
        url = urljoin(final_url, path)
        if same_host(url, final_url):
            candidates.append((url, path))
    pages = [(final_url, home_html, home_links)]
    for link, _ in candidates[:5]:
        try:
            page_html, page_url = fetch(link, timeout=12)
        except (HTTPError, URLError, TimeoutError, OSError):
            continue
        pages.append((page_url, page_html, extract_links(page_html, page_url)))
    combined_html = "\n".join(page[1] for page in pages)
    text = clean_text(combined_html)[:30000]
    gallery_url, link_kind = choose_gallery_or_wedding(final_url, pages)
    return {
        "website": final_url,
        "gallery_url": gallery_url,
        "link_kind": link_kind,
        "email": (extract_emails(combined_html) or [""])[0],
        "phone": (extract_phones(combined_html) or [""])[0],
        "text": text,
        "price_from": extract_price(text),
        "capacity_max": extract_capacity(text),
        "amenities": infer_amenities(text),
        "notes": "" if link_kind != "homepage_fallback" else "No distinct gallery/wedding page found; homepage used.",
    }


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:64].rstrip("-")


def dedupe_candidates(candidates: Iterable[Candidate]) -> list[Candidate]:
    seen: set[str] = set()
    output: list[Candidate] = []
    for candidate in candidates:
        host = urlparse(candidate.website).netloc.lower().removeprefix("www.")
        key = candidate.place_id or host or f"{candidate.name.lower()}|{candidate.address.lower()}"
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(candidate)
    return output


def normalized_name(value: str) -> str:
    cleaned = value.lower()
    cleaned = re.sub(r"\s*\|.*$", "", cleaned)
    cleaned = re.sub(r"\s*\(wedding venue\)", "", cleaned)
    cleaned = re.sub(r"\bluxury wedding venue\b|\bexclusive wedding events venue\b|\bweddings? venue\b", "", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def domain_key(value: str) -> str:
    return urlparse(normalize_url(value)).netloc.lower().removeprefix("www.")


def load_existing_keys(csv_paths: list[Path]) -> tuple[set[str], set[str], set[str]]:
    slugs: set[str] = set()
    names: set[str] = set()
    domains: set[str] = set()
    for csv_path in csv_paths:
        if csv_path and csv_path.exists():
            with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
                for row in csv.DictReader(handle):
                    slug = (row.get("Slug") or row.get("slug") or "").strip()
                    if slug:
                        slugs.add(slug)
                    name = normalized_name(row.get("Venue name") or row.get("name") or "")
                    if name:
                        names.add(name)
                    for key in ("Official website URL", "Official website/source", "website"):
                        domain = domain_key(row.get(key) or "")
                        if domain:
                            domains.add(domain)
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    if supabase_url and service_key:
        try:
            body, _ = fetch(
                f"{supabase_url}/rest/v1/venues?select=slug,name,official_website_url",
                headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
                timeout=20,
            )
            for item in json.loads(body):
                slug = str(item.get("slug", "")).strip()
                if slug:
                    slugs.add(slug)
                name = normalized_name(str(item.get("name", "")))
                if name:
                    names.add(name)
                domain = domain_key(str(item.get("official_website_url", "")))
                if domain:
                    domains.add(domain)
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
            print(f"Warning: could not load Supabase slugs: {error}", file=sys.stderr)
    return slugs, names, domains


def description_for(candidate: Candidate, text: str) -> tuple[str, str]:
    name = candidate.name.strip()
    town = candidate.town.strip()
    venue_type = candidate.type_guess or infer_type(f"{name} {text}")
    lower = text.lower()
    if "exclusive" in lower and ("accommodation" in lower or "bedrooms" in lower):
        summary = f"{name} is an exclusive-use {venue_type.lower()} in {town or candidate.region} with wedding spaces and guest accommodation."
    elif "garden" in lower or "grounds" in lower:
        summary = f"{name} is a {venue_type.lower()} in {town or candidate.region} with ceremony or reception spaces and landscaped grounds."
    else:
        summary = f"{name} is a {venue_type.lower()} in {town or candidate.region} for weddings and private celebrations."
    description = f"{summary} Imported for EverAft launch review from public venue research; confirm copy, pricing, imagery, and permissions before publishing."
    return summary[:220], description


def to_import_row(candidate: Candidate, enrich: dict[str, object], slug: str) -> dict[str, object]:
    text = str(enrich.get("text") or "")
    venue_type = candidate.type_guess or infer_type(f"{candidate.name} {text}")
    summary, description = description_for(candidate, text)
    capacity_max = int(enrich.get("capacity_max") or 120)
    price_from = int(enrich.get("price_from") or 0)
    contact_phone = candidate.phone or str(enrich.get("phone") or "")
    email = str(enrich.get("email") or "")
    missing = []
    if not email:
        missing.append("vendor email")
    if not price_from:
        missing.append("price")
    missing.append("approved hero image")
    if enrich.get("link_kind") == "homepage_fallback":
        missing.append("official gallery/wedding page")
    if candidate.business_status and candidate.business_status != "OPERATIONAL":
        missing.append(f"Google business status: {candidate.business_status}")
    return {
        "Research status": "Needs review",
        "Publish status": "Draft",
        "Priority": "Low",
        "Venue name": candidate.name,
        "Slug": slug,
        "Type": venue_type,
        "Town": candidate.town,
        "Region": candidate.region,
        "Address": candidate.address,
        "Summary": summary,
        "Description": description,
        "Price from": price_from or "",
        "Price to": "",
        "Capacity min": 1,
        "Capacity max": capacity_max,
        "Hero image URL": "",
        "Amenities": str(enrich.get("amenities") or ""),
        "Featured?": "No",
        "Latitude": candidate.latitude,
        "Longitude": candidate.longitude,
        "Contact Number": contact_phone,
        "Official website/source": candidate.website,
        "Image source/permission notes": "Representative image only until official permission is approved.",
        "Missing info / notes": f"Needs manual review: {', '.join(missing)}.",
        "Official website URL": str(enrich.get("website") or candidate.website),
        "Official gallery URL": str(enrich.get("gallery_url") or candidate.website),
        "Vendor contact email": email,
        "Listing status": "draft",
        "Claim status": "unclaimed",
        "Image permission status": "representative",
        "Image credit": "",
        "Image is representative?": "Yes",
        "Is claimed?": "No",
        "Claimant name": "",
        "Claimant email": "",
        "Claimant role": "",
        "Business email": email,
        "Business phone": contact_phone,
        "Evidence URL": candidate.maps_url,
        "Invite status": "not_sent",
        "Invite sent at": "",
        "Claim admin notes": "",
        "Founding partner notes": f"Discovery source: {candidate.source_query}",
    }


def write_rows(rows: list[dict[str, object]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def write_report(rows: list[dict[str, object]], output: Path) -> None:
    fields = ["Venue name", "Slug", "Official website URL", "Official gallery URL", "Vendor contact email", "Contact Number", "Missing info / notes", "Founding partner notes"]
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build an import-ready Scotland venue intake CSV.")
    parser.add_argument("--query", action="append", default=[], help="Override/add Google Places query. Can be repeated.")
    parser.add_argument("--limit-per-query", type=int, default=8)
    parser.add_argument("--target", type=int, default=50, help="Target number of import-ready rows after exclusions.")
    parser.add_argument("--exclude-csv", action="append", type=Path, default=[], help="CSV to exclude by slug/name/domain. Can be repeated.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    return parser.parse_args()


def main() -> int:
    load_env()
    args = parse_args()
    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_MAPS_API_KEY is required.", file=sys.stderr)
        return 2
    queries = args.query or QUERY_PRESETS
    exclude_csvs = args.exclude_csv or [DEFAULT_EXCLUDE_CSV]
    print(
        "Loading existing venues from "
        + ", ".join(str(path) for path in exclude_csvs)
        + " and Supabase...",
        file=sys.stderr,
        flush=True,
    )
    existing_slugs, existing_names, existing_domains = load_existing_keys(exclude_csvs)
    print(
        f"Loaded {len(existing_slugs)} slugs, {len(existing_names)} names, and {len(existing_domains)} domains for exclusion.",
        file=sys.stderr,
        flush=True,
    )
    candidates: list[Candidate] = []
    for query in queries:
        print(f"Searching: {query}", file=sys.stderr, flush=True)
        candidates.extend(google_text_search(query, api_key, args.limit_per_query))
    candidates = dedupe_candidates(candidates)
    print(f"Discovered {len(candidates)} unique candidates before exclusion.", file=sys.stderr, flush=True)
    rows: list[dict[str, object]] = []
    used_slugs = set(existing_slugs)
    used_names = set(existing_names)
    used_domains = set(existing_domains)
    for candidate in candidates:
        if len(rows) >= args.target:
            break
        if not candidate.name or not candidate.town or not candidate.region:
            continue
        name_key = normalized_name(candidate.name)
        site_domain = domain_key(candidate.website)
        if name_key in used_names or (site_domain and site_domain in used_domains):
            continue
        base_slug = slugify(candidate.name)
        slug = base_slug
        suffix = 2
        while slug in used_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        if suffix > 2:
            continue
        print(f"Enriching: {candidate.name}", file=sys.stderr, flush=True)
        enrich = enrich_website(candidate)
        if not enrich.get("website"):
            continue
        row = to_import_row(candidate, enrich, slug)
        rows.append(row)
        used_slugs.add(slug)
        used_names.add(name_key)
        enriched_domain = domain_key(str(row.get("Official website URL", "")))
        if enriched_domain:
            used_domains.add(enriched_domain)
        time.sleep(0.4)
    write_rows(rows, args.output)
    write_report(rows, args.report)
    print(f"Wrote {len(rows)} import-ready rows to {args.output}")
    print(f"Wrote review report to {args.report}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())
