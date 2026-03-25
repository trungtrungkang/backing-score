#!/usr/bin/env python3
"""
import-to-appwrite.py — MusicXML Content Import Pipeline
=========================================================
Reads manifest.json produced by crawl-github-musicxml.py or crawl-musicxml.py
and for each piece:
  1. Finds or auto-creates the composer in wiki_artists
  2. Finds or auto-creates the composition in wiki_compositions
  3. Uploads MusicXML file to Appwrite Storage (uploads bucket)
  4. Creates a Project document (published=false, pending admin review)

Usage:
  pip install appwrite python-dotenv
  python3 scripts/import-to-appwrite.py --manifest ./musicxml-library/manifest.json \\
      --library ./musicxml-library --dry-run

  # Real import (reads credentials from .env.local):
  python3 scripts/import-to-appwrite.py --manifest ./musicxml-library/manifest.json \\
      --library ./musicxml-library

Required env vars (in .env.local):
  NEXT_PUBLIC_APPWRITE_ENDPOINT
  NEXT_PUBLIC_APPWRITE_PROJECT_ID
  APPWRITE_API_KEY           ← Server-side API key (NOT the public client key)
  IMPORT_OWNER_USER_ID       ← Appwrite user ID that will own the imported projects

Optional:
  NEXT_PUBLIC_APPWRITE_DATABASE_ID       (default: backing_score_db)
  NEXT_PUBLIC_APPWRITE_UPLOADS_BUCKET_ID (default: uploads)
"""

import argparse
import json
import os
import sys
import re
import time
import unicodedata
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv(".env")
except ImportError:
    pass  # dotenv optional; env vars can be set manually

try:
    from appwrite.client import Client
    from appwrite.services.databases import Databases
    from appwrite.services.storage import Storage
    from appwrite.input_file import InputFile
    from appwrite.id import ID
    from appwrite.query import Query
    from appwrite.permission import Permission
    from appwrite.role import Role
except ImportError:
    print("❌ appwrite SDK not installed. Run: pip install appwrite")
    sys.exit(1)


# ── Appwrite Resource IDs (mirrors constants.ts) ─────────────────────

DB_ID      = os.getenv("NEXT_PUBLIC_APPWRITE_DATABASE_ID", "backing_score_db")
BUCKET_ID  = os.getenv("NEXT_PUBLIC_APPWRITE_UPLOADS_BUCKET_ID", "uploads")

COL_PROJECTS      = "projects"
COL_WIKI_ARTISTS  = "wiki_artists"
COL_WIKI_COMPS    = "wiki_compositions"


# ── Composer metadata table ───────────────────────────────────────────
# Maps composer_key → {nationality, period, roles}
COMPOSER_META = {
    "bach":           {"nationality": "German",   "period": "Baroque"},
    "beethoven":      {"nationality": "German",   "period": "Classical/Romantic"},
    "mozart":         {"nationality": "Austrian", "period": "Classical"},
    "chopin":         {"nationality": "Polish",   "period": "Romantic"},
    "liszt":          {"nationality": "Hungarian","period": "Romantic"},
    "debussy":        {"nationality": "French",   "period": "Impressionist"},
    "ravel":          {"nationality": "French",   "period": "Impressionist"},
    "schubert":       {"nationality": "Austrian", "period": "Romantic"},
    "schumann":       {"nationality": "German",   "period": "Romantic"},
    "brahms":         {"nationality": "German",   "period": "Romantic"},
    "tchaikovsky":    {"nationality": "Russian",  "period": "Romantic"},
    "dvorak":         {"nationality": "Czech",    "period": "Romantic"},
    "grieg":          {"nationality": "Norwegian","period": "Romantic"},
    "satie":          {"nationality": "French",   "period": "Modern"},
    "joplin":         {"nationality": "American", "period": "Ragtime"},
    "handel":         {"nationality": "German",   "period": "Baroque"},
    "vivaldi":        {"nationality": "Italian",  "period": "Baroque"},
    "haydn":          {"nationality": "Austrian", "period": "Classical"},
    "pachelbel":      {"nationality": "German",   "period": "Baroque"},
    "rimsky-korsakov":{"nationality": "Russian",  "period": "Romantic"},
    "monteverdi":     {"nationality": "Italian",  "period": "Renaissance/Baroque"},
    "palestrina":     {"nationality": "Italian",  "period": "Renaissance"},
    "corelli":        {"nationality": "Italian",  "period": "Baroque"},
    "purcell":        {"nationality": "English",  "period": "Baroque"},
}

# Estimate difficulty from number of measures
def estimate_difficulty(measures: int) -> int:
    if measures <= 16:  return 1
    if measures <= 40:  return 2
    if measures <= 80:  return 3
    if measures <= 160: return 4
    return 5


# ── Text helpers ──────────────────────────────────────────────────────

def slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"--+", "-", text)
    return text.strip("-")[:80]


def normalize_name(name: str) -> str:
    """Lowercase + strip diacritics for fuzzy matching."""
    name = unicodedata.normalize("NFKD", name)
    name = name.encode("ascii", "ignore").decode("ascii")
    return name.lower().strip()


# ── Appwrite helpers ──────────────────────────────────────────────────

def find_artist_by_composer_key(db: Databases, composer_key: str) -> dict | None:
    """Search wiki_artists for an artist whose slug contains composer_key."""
    try:
        res = db.list_documents(DB_ID, COL_WIKI_ARTISTS, queries=[
            Query.search("slug", composer_key),
            Query.limit(5),
        ])
        if res["total"] > 0:
            return res["documents"][0]
    except Exception:
        pass
    # Fallback: list all and fuzzy match
    try:
        res = db.list_documents(DB_ID, COL_WIKI_ARTISTS, queries=[Query.limit(100)])
        for doc in res["documents"]:
            slug = doc.get("slug", "")
            name = normalize_name(doc.get("name", ""))
            if composer_key in slug or composer_key in name:
                return doc
    except Exception:
        pass
    return None


def find_composition(db: Databases, title: str, artist_id: str | None) -> dict | None:
    """Search wiki_compositions by title (fuzzy) and optionally artist."""
    norm_title = normalize_name(title)
    try:
        res = db.list_documents(DB_ID, COL_WIKI_COMPS, queries=[
            Query.search("title", title[:30]),
            Query.limit(10),
        ])
        for doc in res["documents"]:
            doc_title_norm = normalize_name(doc.get("title", ""))
            # Accept if first 20 chars match
            if doc_title_norm[:20] == norm_title[:20]:
                return doc
    except Exception:
        pass
    return None


def create_artist(db: Databases, composer_key: str, full_name: str, dry_run: bool) -> str | None:
    """Create a minimal wiki_artists entry. Returns the new document $id."""
    meta = COMPOSER_META.get(composer_key, {})
    slug = slugify(full_name)
    data = {
        "name": full_name,
        "slug": slug,
        "nationality": meta.get("nationality", ""),
        "roles": ["composer"],
        "bio": "",   # Admin fills in later
    }
    if dry_run:
        print(f"    [DRY-RUN] Would create wiki_artist: {full_name} (slug: {slug})")
        return f"dry-run-artist-{composer_key}"
    try:
        doc = db.create_document(DB_ID, COL_WIKI_ARTISTS, ID.unique(), data,
                                  permissions=[
                                      Permission.read(Role.any()),
                                      Permission.update(Role.label("wiki_editor")),
                                      Permission.delete(Role.label("wiki_editor")),
                                  ])
        print(f"    ✅ Created wiki_artist: {full_name} ({doc['$id']})")
        return doc["$id"]
    except Exception as e:
        print(f"    ⚠ Failed to create artist: {e}")
        return None


def create_composition(db: Databases, title: str, artist_id: str | None,
                        key_sig: str, tempo: int | None, dry_run: bool) -> str | None:
    """Create a minimal wiki_compositions entry. Returns the new document $id."""
    slug = slugify(title)
    data = {
        "title": title,
        "slug": slug,
        "keySignature": key_sig or "",
        "description": "",  # Admin fills in later
    }
    if tempo:
        data["tempo"] = tempo
    if dry_run:
        print(f"    [DRY-RUN] Would create wiki_composition: {title} (slug: {slug})")
        return f"dry-run-composition-{slug}"
    try:
        doc = db.create_document(DB_ID, COL_WIKI_COMPS, ID.unique(), data,
                                  permissions=[
                                      Permission.read(Role.any()),
                                      Permission.update(Role.label("wiki_editor")),
                                      Permission.delete(Role.label("wiki_editor")),
                                  ])
        print(f"    ✅ Created wiki_composition: {title} ({doc['$id']})")
        return doc["$id"]
    except Exception as e:
        print(f"    ⚠ Failed to create composition: {e}")
        return None


def upload_musicxml(storage: Storage, file_path: Path, dry_run: bool) -> str | None:
    """Upload MusicXML file to Appwrite Storage. Returns file ID."""
    if dry_run:
        print(f"    [DRY-RUN] Would upload: {file_path.name}")
        return f"dry-run-file-{file_path.stem}"
    try:
        result = storage.create_file(
            bucket_id=BUCKET_ID,
            file_id=ID.unique(),
            file=InputFile.from_path(str(file_path)),
            permissions=[Permission.read(Role.any())],
        )
        print(f"    ✅ Uploaded file: {file_path.name} ({result['$id']})")
        return result["$id"]
    except Exception as e:
        print(f"    ⚠ Failed to upload file: {e}")
        return None


def build_project_payload(piece: dict, file_id: str) -> dict:
    """Build the DAWPayload JSON for a MusicXML-only project."""
    time_sig = piece.get("timeSignature", "4/4") or "4/4"
    key_sig  = piece.get("key", "C Maj") or "C Maj"
    tempo    = piece.get("tempo", 120) or 120

    return {
        "version": 2,
        "type": "multi-stems",
        "metadata": {
            "tempo": int(tempo),
            "timeSignature": time_sig,
            "keySignature": key_sig,
            "syncToTimemap": False,
            "scoreSynthMuted": False,
            "scoreSynthVolume": 1.0,
            "scoreSynthOffsetMs": 0,
        },
        "audioTracks": [],
        "notationData": {
            "type": "music-xml",
            "fileId": file_id,
            "timemap": [],
            "timemapSource": "auto",
        }
    }


def create_project(db: Databases, owner_id: str, piece: dict, payload: dict,
                    artist_id: str | None, composition_id: str | None,
                    dry_run: bool) -> str | None:
    """Create a Project document (published=false). Returns project $id."""
    name = piece.get("displayName") or piece.get("title", "Untitled")
    measures = piece.get("measures", 0)
    difficulty = estimate_difficulty(measures)
    tags = ["classical", f"difficulty-{difficulty}"]
    # importFile tag enables idempotent re-runs: used to detect already-imported pieces
    tags.append(f"importFile:{piece.get('file', '')}")

    # Instrument tag from parts count (heuristic)
    parts = piece.get("parts", 1)
    if parts <= 2:
        tags.append("piano")

    data = {
        "userId": owner_id,
        "name": name,
        "mode": "practice",
        "payload": json.dumps(payload, ensure_ascii=False),
        "payloadVersion": 2,
        "published": False,
        "creatorEmail": "",
        "tags": tags,
        "difficulty": difficulty,
        "durationSec": 0,  # Admin can update after review
        "description": f"Imported from {piece.get('source', 'Public Domain')}. License: {piece.get('license', 'Public Domain')}.",
    }
    if artist_id:
        data["wikiComposerIds"] = [artist_id]
    if composition_id:
        data["wikiCompositionId"] = composition_id

    permissions = [
        Permission.read(Role.user(owner_id)),
        Permission.update(Role.user(owner_id)),
        Permission.delete(Role.user(owner_id)),
    ]

    if dry_run:
        print(f"    [DRY-RUN] Would create project: {name} (tags: {tags})")
        return f"dry-run-project-{piece.get('composer_key', 'misc')}"
    try:
        doc = db.create_document(DB_ID, COL_PROJECTS, ID.unique(), data, permissions)
        print(f"    ✅ Created project: {name} ({doc['$id']})")
        return doc["$id"]
    except Exception as e:
        print(f"    ⚠ Failed to create project: {e}")
        return None


# ── Main ──────────────────────────────────────────────────────────────

def fetch_imported_file_tags(db: Databases) -> set:
    """Fetch all importFile:* tags from existing projects to detect duplicates."""
    imported = set()
    offset = 0
    while True:
        try:
            res = db.list_documents(DB_ID, COL_PROJECTS, queries=[
                Query.limit(100),
                Query.offset(offset),
                Query.select(["tags"]),
            ])
            docs = res["documents"]
            if not docs:
                break
            for doc in docs:
                for tag in (doc.get("tags") or []):
                    if tag.startswith("importFile:"):
                        imported.add(tag[len("importFile:"):])
            if len(docs) < 100:
                break
            offset += 100
        except Exception as e:
            print(f"  ⚠ Could not fetch existing projects: {e}")
            break
    return imported


def main():
    parser = argparse.ArgumentParser(description="Import MusicXML manifest into Appwrite")
    parser.add_argument("--manifest", "-m", required=True,
                        help="Path to manifest.json (from crawl scripts)")
    parser.add_argument("--library", "-l", default="./musicxml-library",
                        help="Root directory of MusicXML library (default: ./musicxml-library)")
    parser.add_argument("--dry-run", "-n", action="store_true",
                        help="Simulate without writing to Appwrite")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max number of pieces to import")
    parser.add_argument("--composer", default=None,
                        help="Filter to only import pieces by this composer_key")
    parser.add_argument("--force", action="store_true",
                        help="Re-import pieces even if already in Appwrite")
    args = parser.parse_args()

    # ── Load env & validate ──────────────────────────────────────────
    endpoint   = os.getenv("NEXT_PUBLIC_APPWRITE_ENDPOINT")
    project_id = os.getenv("NEXT_PUBLIC_APPWRITE_PROJECT_ID")
    api_key    = os.getenv("APPWRITE_API_KEY")
    owner_id   = os.getenv("IMPORT_OWNER_USER_ID")

    if not args.dry_run:
        if not endpoint or not project_id or not api_key or not owner_id:
            print("❌ Missing required env vars:")
            print("   NEXT_PUBLIC_APPWRITE_ENDPOINT")
            print("   NEXT_PUBLIC_APPWRITE_PROJECT_ID")
            print("   APPWRITE_API_KEY  (server-side key from Appwrite Console)")
            print("   IMPORT_OWNER_USER_ID  (your Appwrite user $id)")
            print("\nHint: add these to .env.local and re-run.")
            sys.exit(1)

    # ── Init Appwrite client ─────────────────────────────────────────
    client = Client()
    if not args.dry_run:
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

    db      = Databases(client)
    storage = Storage(client)

    # ── Load manifest ────────────────────────────────────────────────
    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"❌ Manifest not found: {manifest_path}")
        sys.exit(1)

    raw = json.loads(manifest_path.read_text())
    pieces = raw["pieces"] if isinstance(raw, dict) else raw
    print(f"📋 Loaded manifest: {len(pieces)} pieces")

    if args.composer:
        pieces = [p for p in pieces if p.get("composer_key") == args.composer]
        print(f"   Filtered to composer '{args.composer}': {len(pieces)} pieces")

    if args.limit:
        pieces = pieces[:args.limit]
        print(f"   Limited to first {args.limit} pieces")

    library_dir = Path(args.library)

    # ── Fetch already-imported file paths from Appwrite ──────────────
    already_imported: set = set()
    if not args.dry_run and not args.force:
        print("🔍 Checking for already-imported pieces...")
        already_imported = fetch_imported_file_tags(db)
        print(f"   Found {len(already_imported)} already imported pieces in Appwrite")

    # ── Import loop ──────────────────────────────────────────────────
    artist_cache      : dict[str, str] = {}  # composer_key → artist_id
    composition_cache : dict[str, str] = {}  # title_key → composition_id

    imported = 0
    skipped  = 0
    errors   = 0

    print(f"\n{'='*60}")
    print(f"{'[DRY-RUN] ' if args.dry_run else ''}Starting import — {len(pieces)} pieces")
    print(f"{'='*60}\n")

    for i, piece in enumerate(pieces):
        title        = piece.get("title") or piece.get("displayName") or "Untitled"
        composer_key = piece.get("composer_key", "miscellaneous")
        composer_full= piece.get("composer", "Various")
        file_rel     = piece.get("file", "")

        print(f"[{i+1}/{len(pieces)}] {title} — {composer_full}")

        # ── Skip if already imported ─────────────────────────────────
        if file_rel in already_imported and not args.force:
            print(f"  ⏭ Already imported, skipping (use --force to re-import)")
            skipped += 1
            continue

        # Locate file
        file_path = library_dir / file_rel
        if not file_path.exists():
            print(f"  ⚠ File not found: {file_path}, skipping")
            errors += 1
            continue

        # ── Step 1: Find or create wiki_artist ──────────────────────
        if composer_key not in artist_cache:
            artist = find_artist_by_composer_key(db, composer_key) if not args.dry_run else None
            if artist:
                print(f"  🔗 Found artist: {artist['name']} ({artist['$id']})")
                artist_cache[composer_key] = artist["$id"]
            else:
                new_id = create_artist(db, composer_key, composer_full, args.dry_run)
                artist_cache[composer_key] = new_id
                time.sleep(0.2)  # Rate limit
        artist_id = artist_cache.get(composer_key)

        # ── Step 2: Find or create wiki_composition ─────────────────
        comp_key = f"{composer_key}::{title[:40]}"
        if comp_key not in composition_cache:
            composition = find_composition(db, title, artist_id) if not args.dry_run else None
            if composition:
                print(f"  🔗 Found composition: {composition['title']} ({composition['$id']})")
                composition_cache[comp_key] = composition["$id"]
            else:
                new_id = create_composition(
                    db, title, artist_id,
                    key_sig=piece.get("key", ""),
                    tempo=piece.get("tempo"),
                    dry_run=args.dry_run,
                )
                composition_cache[comp_key] = new_id
                time.sleep(0.2)
        composition_id = composition_cache.get(comp_key)

        # ── Step 3: Upload MusicXML ──────────────────────────────────
        file_id = upload_musicxml(storage, file_path, args.dry_run)
        if not file_id:
            errors += 1
            continue
        time.sleep(0.3)

        # ── Step 4: Build payload ────────────────────────────────────
        payload = build_project_payload(piece, file_id)

        # ── Step 5: Create project document ─────────────────────────
        owner = owner_id or "dry-run-owner"
        proj_id = create_project(db, owner, piece, payload,
                                  artist_id, composition_id, args.dry_run)
        if not proj_id:
            errors += 1
            continue

        imported += 1
        print(f"  ✅ Done\n")
        time.sleep(0.3)

    # ── Summary ──────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"{'[DRY-RUN] ' if args.dry_run else ''}Import complete!")
    print(f"  Imported : {imported}")
    print(f"  Skipped  : {skipped}")
    print(f"  Errors   : {errors}")
    print(f"  Total    : {len(pieces)}")
    print(f"{'='*60}")
    print()
    if not args.dry_run and imported > 0:
        print("📌 Next step: Go to /admin to review and publish imported projects.")
        print("   Imported projects are saved as published=false (drafts).")


if __name__ == "__main__":
    main()
