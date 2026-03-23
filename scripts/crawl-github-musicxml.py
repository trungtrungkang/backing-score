#!/usr/bin/env python3
"""
Download public-domain MusicXML files from curated GitHub repositories.
All compositions are Public Domain — safe for any use.

Sources:
  - musetrainer/library  (Public Domain .mxl files)
  - Additional repos can be added via SOURCES dict

Usage:
  python3 scripts/crawl-github-musicxml.py [--output ./musicxml-library]

Output:
  Merges downloaded files into the existing musicxml-library/ structure
  and updates manifest.json.
"""

import argparse
import json
import os
import sys
import re
import zipfile
import io
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from xml.etree import ElementTree as ET

# ── Composer mappings for musetrainer/library ──────────────────────────────────
# Map filename patterns to (composer_key, full_name)
COMPOSER_PATTERNS = [
    (r"(?i)bach",           "bach",         "Johann Sebastian Bach"),
    (r"(?i)beethoven",      "beethoven",    "Ludwig van Beethoven"),
    (r"(?i)mozart",         "mozart",       "Wolfgang Amadeus Mozart"),
    (r"(?i)chopin",         "chopin",       "Frédéric Chopin"),
    (r"(?i)debussy",        "debussy",      "Claude Debussy"),
    (r"(?i)liszt",          "liszt",        "Franz Liszt"),
    (r"(?i)tchaikovsky",    "tchaikovsky",  "Pyotr Ilyich Tchaikovsky"),
    (r"(?i)satie",          "satie",        "Erik Satie"),
    (r"(?i)brahms",         "brahms",       "Johannes Brahms"),
    (r"(?i)joplin",         "joplin",       "Scott Joplin"),
    (r"(?i)schubert",       "schubert",     "Franz Schubert"),
    (r"(?i)ravel",          "ravel",        "Maurice Ravel"),
    (r"(?i)grieg",          "grieg",        "Edvard Grieg"),
    (r"(?i)dvorak|dvořák",  "dvorak",       "Antonín Dvořák"),
    (r"(?i)handel",         "handel",       "George Frideric Handel"),
    (r"(?i)pachelbel",      "pachelbel",    "Johann Pachelbel"),
    (r"(?i)rimsky",         "rimsky-korsakov", "Nikolai Rimsky-Korsakov"),
]


def detect_composer(filename: str):
    """Detect composer from filename. Returns (key, full_name) or None."""
    for pattern, key, full_name in COMPOSER_PATTERNS:
        if re.search(pattern, filename):
            return key, full_name
    return None, None


def sanitize_filename(name: str) -> str:
    """Make a string safe for use as a filename."""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', '_', name)
    name = name.strip('._')
    return name[:100]


def extract_title_from_filename(filename: str) -> str:
    """Extract a readable title from MXL filename."""
    # Remove extension
    name = Path(filename).stem
    # Remove common patterns
    name = re.sub(r'_+', ' ', name)
    name = name.strip()
    return name


def extract_musicxml_from_mxl(mxl_data: bytes) -> str | None:
    """Extract MusicXML content from .mxl (compressed MusicXML = zip)."""
    try:
        with zipfile.ZipFile(io.BytesIO(mxl_data)) as zf:
            # Find the MusicXML file inside the zip
            for name in zf.namelist():
                if name.endswith('.xml') and not name.startswith('META-INF'):
                    return zf.read(name).decode('utf-8')
            # Fallback: try any .xml file
            for name in zf.namelist():
                if name.endswith('.xml'):
                    return zf.read(name).decode('utf-8')
    except (zipfile.BadZipFile, Exception) as e:
        print(f"    ⚠ Failed to extract MXL: {e}")
    return None


def get_musicxml_metadata(xml_content: str):
    """Extract basic metadata from MusicXML content."""
    parts = 0
    measures = 0
    title = None
    key = None
    
    try:
        root = ET.fromstring(xml_content)
        ns = ''
        # Check for namespace
        if root.tag.startswith('{'):
            ns = root.tag.split('}')[0] + '}'
        
        # Count parts
        parts = len(root.findall(f'{ns}part'))
        if parts == 0:
            parts = len(root.findall(f'.//{ns}score-part'))
        
        # Count measures in first part
        first_part = root.find(f'{ns}part')
        if first_part is not None:
            measures = len(first_part.findall(f'{ns}measure'))
        
        # Get title
        work_title = root.find(f'{ns}work/{ns}work-title')
        if work_title is not None and work_title.text:
            title = work_title.text
        else:
            movement = root.find(f'{ns}movement-title')
            if movement is not None and movement.text:
                title = movement.text
        
        # Get key (from first key element)
        key_elem = root.find(f'.//{ns}key')
        if key_elem is not None:
            fifths_elem = key_elem.find(f'{ns}fifths')
            mode_elem = key_elem.find(f'{ns}mode')
            if fifths_elem is not None:
                fifths = int(fifths_elem.text)
                mode = mode_elem.text if mode_elem is not None else 'major'
                key_names_major = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
                                    'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
                key_names_minor = ['a', 'e', 'b', 'f#', 'c#', 'g#', 'd#', 'a#',
                                    'd', 'g', 'c', 'f', 'bb', 'eb', 'ab']
                if mode == 'minor':
                    idx = fifths if fifths >= 0 else (len(key_names_minor) + fifths)
                    key = f"{key_names_minor[idx % len(key_names_minor)]} minor"
                else:
                    idx = fifths if fifths >= 0 else (len(key_names_major) + fifths)
                    key = f"{key_names_major[idx % len(key_names_major)]} major"
                    
    except ET.ParseError:
        pass
    
    return title, parts, measures, key


def fetch_github_contents(repo: str, path: str = ""):
    """Fetch directory listing from GitHub API."""
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    req = Request(url, headers={"User-Agent": "musicxml-crawler/1.0"})
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except HTTPError as e:
        print(f"  ⚠ GitHub API error: {e.code} for {url}")
        return []


def download_file(url: str) -> bytes | None:
    """Download a file from a URL."""
    req = Request(url, headers={"User-Agent": "musicxml-crawler/1.0"})
    try:
        with urlopen(req) as resp:
            return resp.read()
    except (HTTPError, URLError) as e:
        print(f"  ⚠ Download failed: {e}")
        return None


def crawl_musetrainer(output_dir: Path, existing_files: set):
    """Crawl musetrainer/library GitHub repo for MXL files."""
    print("\n🎵 musetrainer/library (Public Domain piano scores)")
    print("=" * 60)
    
    contents = fetch_github_contents("musetrainer/library", "scores")
    if not contents:
        print("  ⚠ Could not fetch repo contents")
        return []
    
    mxl_files = [f for f in contents if f["name"].endswith(".mxl")]
    print(f"  📂 Found {len(mxl_files)} .mxl files")
    
    results = []
    exported = 0
    skipped = 0
    errors = 0
    
    for i, file_info in enumerate(mxl_files):
        filename = file_info["name"]
        download_url = file_info["download_url"]
        
        # Detect composer
        composer_key, composer_full = detect_composer(filename)
        if not composer_key:
            composer_key = "miscellaneous"
            composer_full = "Various"
        
        # Create output path
        stem = sanitize_filename(Path(filename).stem)
        out_path = f"{composer_key}/{stem}.musicxml"
        full_path = output_dir / out_path
        
        # Skip if already exists
        if out_path in existing_files or full_path.exists():
            print(f"  ⏭ already exists: {stem}")
            skipped += 1
            continue
        
        # Download
        print(f"  ⬇ [{i+1}/{len(mxl_files)}] {filename}...", end=" ", flush=True)
        data = download_file(download_url)
        if not data:
            errors += 1
            continue
        
        # Extract MusicXML from MXL
        xml_content = extract_musicxml_from_mxl(data)
        if not xml_content:
            print("❌ (not a valid MXL)")
            errors += 1
            continue
        
        # Get metadata
        title, parts, measures, key = get_musicxml_metadata(xml_content)
        if not title:
            title = extract_title_from_filename(filename)
        
        # Build display name
        display_name = f"{composer_full} - {title}" if composer_full != "Various" else title
        
        # Save
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(xml_content, encoding='utf-8')
        
        print(f"✓ {display_name} ({parts} parts, {measures} measures)")
        
        results.append({
            "file": out_path,
            "composer": composer_full,
            "composer_key": composer_key,
            "title": title or stem,
            "displayName": display_name,
            "parts": parts or 1,
            "measures": measures or 0,
            "key": key,
            "source": "musetrainer/library",
            "license": "Public Domain"
        })
        exported += 1
        
        # Rate limit: small delay between downloads
        time.sleep(0.3)
    
    print(f"\n  ✅ musetrainer: {exported} exported, {skipped} skipped, {errors} errors")
    return results


def main():
    parser = argparse.ArgumentParser(description="Download MusicXML from GitHub repos")
    parser.add_argument("--output", default="./musicxml-library",
                        help="Output directory (default: ./musicxml-library)")
    args = parser.parse_args()
    
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "manifest.json"
    
    # Load existing manifest (format: {source, license, total, pieces: [...]})
    existing_pieces = []
    existing_files = set()
    if manifest_path.exists():
        try:
            raw = json.loads(manifest_path.read_text())
            if isinstance(raw, dict) and "pieces" in raw:
                existing_pieces = raw["pieces"]
            elif isinstance(raw, list):
                existing_pieces = raw
            existing_files = {entry["file"] for entry in existing_pieces}
            print(f"📋 Loaded existing manifest: {len(existing_pieces)} entries")
        except (json.JSONDecodeError, KeyError):
            print("⚠ Could not parse existing manifest, starting fresh")
    
    print("\n" + "=" * 60)
    print("🌐 GitHub MusicXML Crawler")
    print("   All sources are Public Domain / CC0")
    print("=" * 60)
    
    # Crawl sources
    new_entries = []
    new_entries.extend(crawl_musetrainer(output_dir, existing_files))
    
    # Merge into manifest
    if new_entries:
        merged_pieces = existing_pieces + new_entries
        manifest = {
            "source": "music21 corpus + GitHub repos",
            "license": "Public Domain / CC0",
            "total": len(merged_pieces),
            "pieces": merged_pieces
        }
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
        print(f"\n✅ Manifest updated: {len(existing_pieces)} existing + {len(new_entries)} new = {len(merged_pieces)} total")
    else:
        print("\n✅ No new entries to add")
    
    print(f"\n{'=' * 60}")
    print(f"✅ Done! New files: {len(new_entries)}")
    print(f"   Manifest: {manifest_path}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
