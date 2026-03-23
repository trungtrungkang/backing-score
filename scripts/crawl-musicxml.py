#!/usr/bin/env python3
"""
Crawl classical MusicXML files from the music21 corpus.
All compositions are Public Domain — safe for any use.

Usage:
  pip install music21
  python3 scripts/crawl-musicxml.py [--output ./musicxml-library] [--limit 50]

Output structure:
  musicxml-library/
    bach/
      bwv1.musicxml
      bwv2.musicxml
    beethoven/
      opus18no1.musicxml
    mozart/
      ...
"""

import argparse
import os
import sys
import json
import re
from pathlib import Path

try:
    from music21 import corpus, converter, metadata
except ImportError:
    print("❌ music21 not installed. Run: pip install music21")
    sys.exit(1)


# ── Composers to crawl ────────────────────────────────────────────────────────
# These are all pre-1900 composers whose works are firmly Public Domain
COMPOSERS = {
    "bach":        {"full_name": "Johann Sebastian Bach",       "max": 80},
    "beethoven":   {"full_name": "Ludwig van Beethoven",        "max": 40},
    "mozart":      {"full_name": "Wolfgang Amadeus Mozart",     "max": 40},
    "chopin":      {"full_name": "Frédéric Chopin",             "max": 30},
    "haydn":       {"full_name": "Joseph Haydn",                "max": 30},
    "schubert":    {"full_name": "Franz Schubert",              "max": 20},
    "schumann":    {"full_name": "Robert Schumann",             "max": 20},
    "handel":      {"full_name": "George Frideric Handel",      "max": 20},
    "brahms":      {"full_name": "Johannes Brahms",             "max": 15},
    "vivaldi":     {"full_name": "Antonio Vivaldi",             "max": 15},
    "debussy":     {"full_name": "Claude Debussy",              "max": 15},
    "ravel":       {"full_name": "Maurice Ravel",               "max": 10},
    "dvorak":      {"full_name": "Antonín Dvořák",              "max": 10},
    "grieg":       {"full_name": "Edvard Grieg",                "max": 10},
    "liszt":       {"full_name": "Franz Liszt",                 "max": 10},
    "tchaikovsky": {"full_name": "Pyotr Ilyich Tchaikovsky",    "max": 10},
    "monteverdi":  {"full_name": "Claudio Monteverdi",          "max": 10},
    "palestrina":  {"full_name": "Giovanni Pierluigi da Palestrina", "max": 10},
    "corelli":     {"full_name": "Arcangelo Corelli",           "max": 10},
    "purcell":     {"full_name": "Henry Purcell",               "max": 10},
}


def sanitize_filename(name: str) -> str:
    """Make a string safe for use as a filename."""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', '_', name)
    name = name.strip('._')
    return name[:100]  # limit length


def get_piece_title(score) -> str:
    """Extract a human-readable title from a music21 score."""
    md = score.metadata
    if md:
        if md.title and not md.title.endswith('.mxl') and not md.title.endswith('.xml'):
            return md.title
        if md.movementName:
            return md.movementName
        if hasattr(md, 'alternativeTitle') and md.alternativeTitle:
            return md.alternativeTitle
    return None


def make_display_name(composer_key: str, composer_full: str, safe_name: str, score_title: str, key_sig: str) -> str:
    """Generate a human-readable display name for a piece.
    Examples: 'Bach - BWV 1.6 Chorale (F major)', 'Beethoven - Sonata No. 8 (c minor)'
    """
    # Use score title if it's meaningful (not just a filename)
    if score_title and not score_title.endswith('.mxl') and not score_title.endswith('.xml'):
        name = f"{composer_full} - {score_title}"
    else:
        # Format BWV/opus numbers nicely
        pretty = safe_name
        # Turn bwv1.6 → BWV 1.6, opus18 → Opus 18, etc.
        pretty = re.sub(r'^bwv(\d)', r'BWV \1', pretty, flags=re.IGNORECASE)
        pretty = re.sub(r'^opus(\d)', r'Opus \1', pretty, flags=re.IGNORECASE)
        pretty = re.sub(r'^op(\d)', r'Op. \1', pretty, flags=re.IGNORECASE)
        pretty = re.sub(r'^k(\d)', r'K. \1', pretty, flags=re.IGNORECASE)  # Mozart
        pretty = re.sub(r'^hob', r'Hob. ', pretty, flags=re.IGNORECASE)  # Haydn
        pretty = pretty.replace('_', ' ')
        name = f"{composer_full} - {pretty}"
    
    if key_sig:
        name += f" ({key_sig})"
    return name


def export_corpus(output_dir: Path, global_limit: int = None, composers_dict: dict = None):
    """Export music21 corpus pieces to MusicXML files."""
    
    total_exported = 0
    total_skipped = 0
    total_errors = 0
    manifest = []
    
    target_composers = composers_dict or COMPOSERS

    for composer_key, info in target_composers.items():
        composer_dir = output_dir / composer_key
        composer_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n🎵 {info['full_name']} ({composer_key})")
        
        try:
            paths = corpus.getComposer(composer_key)
        except Exception:
            print(f"  ⚠ No corpus entries found for {composer_key}")
            continue

        if not paths:
            print(f"  ⚠ No files found in corpus for {composer_key}")
            continue

        print(f"  📂 Found {len(paths)} items in corpus")
        
        composer_count = 0
        composer_max = info["max"]
        
        for corpus_path in paths:
            if composer_count >= composer_max:
                break
            if global_limit and total_exported >= global_limit:
                break

            # Skip non-music files
            path_str = str(corpus_path)
            basename = os.path.basename(path_str)
            name_no_ext = os.path.splitext(basename)[0]
            
            # Build output filename
            safe_name = sanitize_filename(name_no_ext)
            out_file = composer_dir / f"{safe_name}.musicxml"

            # Skip if already exported
            if out_file.exists():
                print(f"  ⏭ already exists: {safe_name}")
                total_skipped += 1
                composer_count += 1
                continue

            try:
                score = corpus.parse(corpus_path)
                score_title = get_piece_title(score)
                
                # Get some metadata
                parts_count = len(score.parts) if hasattr(score, 'parts') else 0
                measures_count = 0
                if parts_count > 0:
                    measures_count = len(score.parts[0].getElementsByClass('Measure'))
                
                # Try to get key signature
                key_str = ""
                key = score.analyze('key')
                if key:
                    key_str = str(key)
                
                # Generate display name
                display_name = make_display_name(
                    composer_key, info["full_name"], safe_name, score_title or "", key_str
                )
                
                # Export to MusicXML
                score.write('musicxml', fp=str(out_file))
                
                entry = {
                    "file": str(out_file.relative_to(output_dir)),
                    "composer": info["full_name"],
                    "composer_key": composer_key,
                    "title": score_title or safe_name,
                    "displayName": display_name,
                    "corpus_path": path_str,
                    "parts": parts_count,
                    "measures": measures_count,
                }
                
                if key_str:
                    entry["key"] = key_str
                
                manifest.append(entry)
                total_exported += 1
                composer_count += 1
                print(f"  ✓ {safe_name} — {display_name} ({parts_count} parts, {measures_count} measures)")
                
            except Exception as e:
                total_errors += 1
                print(f"  ✗ {safe_name}: {str(e)[:80]}")
                continue

        if global_limit and total_exported >= global_limit:
            print(f"\n⏹ Global limit of {global_limit} reached.")
            break

    # Write manifest
    manifest_file = output_dir / "manifest.json"
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump({
            "source": "music21 corpus",
            "license": "Public Domain / BSD",
            "total": total_exported,
            "pieces": manifest,
        }, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"✅ Export complete!")
    print(f"   Exported: {total_exported}")
    print(f"   Skipped:  {total_skipped}")
    print(f"   Errors:   {total_errors}")
    print(f"   Manifest: {manifest_file}")
    print(f"{'='*60}")
    
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Export classical MusicXML from music21 corpus")
    parser.add_argument("--output", "-o", default="./musicxml-library",
                        help="Output directory (default: ./musicxml-library)")
    parser.add_argument("--limit", "-l", type=int, default=None,
                        help="Global max number of files to export")
    parser.add_argument("--composers", "-c", nargs="*", default=None,
                        help="Specific composers to export (e.g. bach beethoven)")
    parser.add_argument("--list", action="store_true",
                        help="Just list available composers and counts, don't export")
    args = parser.parse_args()

    if args.list:
        print("📋 Available composers in music21 corpus:\n")
        for key in sorted(COMPOSERS.keys()):
            try:
                paths = corpus.getComposer(key)
                count = len(paths) if paths else 0
            except:
                count = 0
            print(f"  {key:20s}  {count:4d} items  (limit: {COMPOSERS[key]['max']})")
        return

    # Filter composers if specified
    composers_to_use = dict(COMPOSERS)
    if args.composers:
        filtered = {}
        for c in args.composers:
            c_lower = c.lower()
            if c_lower in composers_to_use:
                filtered[c_lower] = composers_to_use[c_lower]
            else:
                print(f"⚠ Unknown composer: {c} (available: {', '.join(composers_to_use.keys())})")
        if not filtered:
            print("❌ No valid composers specified.")
            sys.exit(1)
        composers_to_use = filtered

    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"🎼 MusicXML Corpus Exporter")
    print(f"   Output: {output_dir}")
    print(f"   Composers: {len(composers_to_use)}")
    if args.limit:
        print(f"   Global limit: {args.limit}")
    print()
    
    export_corpus(output_dir, args.limit, composers_to_use)


if __name__ == "__main__":
    main()
