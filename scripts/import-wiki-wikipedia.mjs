#!/usr/bin/env node
/**
 * Import rich wiki content from Wikipedia REST API.
 * Fetches detailed extracts for artists, instruments, compositions, and genres.
 *
 * Run: node scripts/import-wiki-wikipedia.mjs
 */

import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases, ID, Permission, Role, Query } from "node-appwrite";

config({ path: ".env.local", override: true });

const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);
const PERMS = [Permission.read(Role.any())];

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Wikipedia Fetch ──────────────────────────────────────────────────────────

const WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary";
const WIKI_EXTRACT_API = "https://en.wikipedia.org/w/api.php";

async function fetchWikiExtract(title, maxChars = 3900) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const params = new URLSearchParams({
        action: "query",
        titles: title,
        prop: "extracts",
        exlimit: "1",
        format: "json",
        origin: "*",
      });
      const resp = await fetch(`${WIKI_EXTRACT_API}?${params}`, {
        headers: { "User-Agent": "BackingAndScore/1.0 (music-encyclopedia; educational)" }
      });
      if (!resp.ok) {
        if (resp.status === 429) {
          console.log(`  ⏳ rate limited, waiting ${(attempt + 1) * 5}s...`);
          await sleep((attempt + 1) * 5000);
          continue;
        }
        return null;
      }
      const text = await resp.text();
      if (!text.startsWith('{')) {
        console.log(`  ⏳ rate limited (HTML response), waiting ${(attempt + 1) * 5}s...`);
        await sleep((attempt + 1) * 5000);
        continue;
      }
      const data = JSON.parse(text);
      const pages = data.query?.pages || {};
      const page = Object.values(pages)[0];
      if (!page || page.missing !== undefined) return null;

      let html = page.extract || "";
      html = html.replace(/<span[^>]*>|<\/span>/g, "");
      html = html.replace(/<link[^>]*>/g, "");
      html = html.replace(/class="[^"]*"/g, "");
      html = html.replace(/id="[^"]*"/g, "");
      html = html.replace(/<div[^>]*>|<\/div>/g, "");
      html = html.replace(/\n{3,}/g, "\n\n");
      html = html.trim();

      if (html.length > maxChars) {
        let truncated = html.substring(0, maxChars);
        const lastClose = truncated.lastIndexOf("</p>");
        if (lastClose > maxChars * 0.3) {
          truncated = truncated.substring(0, lastClose + 4);
        }
        html = truncated;
      }

      return html || null;
    } catch (e) {
      if (attempt < 2) {
        await sleep((attempt + 1) * 2000);
        continue;
      }
      console.error(`  ⚠ fetch failed for "${title}": ${e.message}`);
      return null;
    }
  }
  return null;
}

async function fetchWikiSummary(title) {
  try {
    const resp = await fetch(`${WIKI_API}/${encodeURIComponent(title)}`, {
      headers: { "User-Agent": "BackingAndScore/1.0 (music-encyclopedia; educational)" }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      extract: data.extract || null,
      imageUrl: data.thumbnail?.source || data.originalimage?.source || null,
      description: data.description || null,
    };
  } catch { return null; }
}

async function getOrCreate(collectionId, slug, data, label) {
  try {
    const { documents } = await databases.listDocuments(DB, collectionId, [
      Query.equal("slug", slug), Query.limit(1),
    ]);
    if (documents.length > 0) {
      // Update with richer content
      await databases.updateDocument(DB, collectionId, documents[0].$id, data);
      console.log(`  ↻ updated: ${label}`);
      return documents[0].$id;
    }
  } catch {}
  const doc = await databases.createDocument(DB, collectionId, ID.unique(), { ...data, slug }, PERMS);
  console.log(`  ✓ created: ${label}`);
  return doc.$id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY LISTS — Wikipedia article titles mapped to our data
// ═══════════════════════════════════════════════════════════════════════════════

const ARTIST_ENTRIES = [
  // Classical / Baroque
  { wiki: "Johann_Sebastian_Bach", name: "Johann Sebastian Bach", nationality: "German", birthDate: "1685-03-31", deathDate: "1750-07-28", roles: ["Composer", "Organist"] },
  { wiki: "Ludwig_van_Beethoven", name: "Ludwig van Beethoven", nationality: "German", birthDate: "1770-12-17", deathDate: "1827-03-26", roles: ["Composer", "Pianist"] },
  { wiki: "Wolfgang_Amadeus_Mozart", name: "Wolfgang Amadeus Mozart", nationality: "Austrian", birthDate: "1756-01-27", deathDate: "1791-12-05", roles: ["Composer", "Pianist", "Violinist"] },
  { wiki: "Frédéric_Chopin", name: "Frédéric Chopin", nationality: "Polish", birthDate: "1810-03-01", deathDate: "1849-10-17", roles: ["Composer", "Pianist"] },
  { wiki: "Claude_Debussy", name: "Claude Debussy", nationality: "French", birthDate: "1862-08-22", deathDate: "1918-03-25", roles: ["Composer", "Pianist"] },
  { wiki: "Pyotr_Ilyich_Tchaikovsky", name: "Pyotr Ilyich Tchaikovsky", nationality: "Russian", birthDate: "1840-05-07", deathDate: "1893-11-06", roles: ["Composer", "Conductor"] },
  { wiki: "Antonio_Vivaldi", name: "Antonio Vivaldi", nationality: "Italian", birthDate: "1678-03-04", deathDate: "1741-07-28", roles: ["Composer", "Violinist", "Priest"] },
  { wiki: "Franz_Schubert", name: "Franz Schubert", nationality: "Austrian", birthDate: "1797-01-31", deathDate: "1828-11-19", roles: ["Composer"] },
  { wiki: "Johann_Strauss_II", name: "Johann Strauss II", nationality: "Austrian", birthDate: "1825-10-25", deathDate: "1899-06-03", roles: ["Composer", "Conductor"] },
  { wiki: "Franz_Liszt", name: "Franz Liszt", nationality: "Hungarian", birthDate: "1811-10-22", deathDate: "1886-07-31", roles: ["Composer", "Pianist", "Conductor"] },
  { wiki: "Johannes_Brahms", name: "Johannes Brahms", nationality: "German", birthDate: "1833-05-07", deathDate: "1897-04-03", roles: ["Composer", "Pianist", "Conductor"] },
  { wiki: "George_Frideric_Handel", name: "George Frideric Handel", nationality: "German-British", birthDate: "1685-02-23", deathDate: "1759-04-14", roles: ["Composer", "Organist"] },
  { wiki: "Joseph_Haydn", name: "Joseph Haydn", nationality: "Austrian", birthDate: "1732-03-31", deathDate: "1809-05-31", roles: ["Composer"] },
  { wiki: "Robert_Schumann", name: "Robert Schumann", nationality: "German", birthDate: "1810-06-08", deathDate: "1856-07-29", roles: ["Composer", "Pianist", "Critic"] },
  { wiki: "Felix_Mendelssohn", name: "Felix Mendelssohn", nationality: "German", birthDate: "1809-02-03", deathDate: "1847-11-04", roles: ["Composer", "Pianist", "Conductor"] },
  { wiki: "Sergei_Rachmaninoff", name: "Sergei Rachmaninoff", nationality: "Russian", birthDate: "1873-04-01", deathDate: "1943-03-28", roles: ["Composer", "Pianist", "Conductor"] },
  { wiki: "Giuseppe_Verdi", name: "Giuseppe Verdi", nationality: "Italian", birthDate: "1813-10-10", deathDate: "1901-01-27", roles: ["Composer"] },
  { wiki: "Richard_Wagner", name: "Richard Wagner", nationality: "German", birthDate: "1813-05-22", deathDate: "1883-02-13", roles: ["Composer", "Conductor"] },
  { wiki: "Igor_Stravinsky", name: "Igor Stravinsky", nationality: "Russian-American", birthDate: "1882-06-17", deathDate: "1971-04-06", roles: ["Composer", "Pianist", "Conductor"] },
  { wiki: "Dmitri_Shostakovich", name: "Dmitri Shostakovich", nationality: "Russian", birthDate: "1906-09-25", deathDate: "1975-08-09", roles: ["Composer", "Pianist"] },
  { wiki: "Antonín_Dvořák", name: "Antonín Dvořák", nationality: "Czech", birthDate: "1841-09-08", deathDate: "1904-05-01", roles: ["Composer"] },
  { wiki: "Niccolò_Paganini", name: "Niccolò Paganini", nationality: "Italian", birthDate: "1782-10-27", deathDate: "1840-05-27", roles: ["Violinist", "Composer"] },
  { wiki: "Giacomo_Puccini", name: "Giacomo Puccini", nationality: "Italian", birthDate: "1858-12-22", deathDate: "1924-11-29", roles: ["Composer"] },
  { wiki: "Maurice_Ravel", name: "Maurice Ravel", nationality: "French", birthDate: "1875-03-07", deathDate: "1937-12-28", roles: ["Composer", "Pianist"] },
  { wiki: "Edvard_Grieg", name: "Edvard Grieg", nationality: "Norwegian", birthDate: "1843-06-15", deathDate: "1907-09-04", roles: ["Composer", "Pianist"] },
  // Jazz
  { wiki: "Miles_Davis", name: "Miles Davis", nationality: "American", birthDate: "1926-05-26", deathDate: "1991-09-28", roles: ["Trumpeter", "Composer", "Bandleader"] },
  { wiki: "Duke_Ellington", name: "Duke Ellington", nationality: "American", birthDate: "1899-04-29", deathDate: "1974-05-24", roles: ["Composer", "Pianist", "Bandleader"] },
  { wiki: "John_Coltrane", name: "John Coltrane", nationality: "American", birthDate: "1926-09-23", deathDate: "1967-07-17", roles: ["Saxophonist", "Composer"] },
  { wiki: "Ella_Fitzgerald", name: "Ella Fitzgerald", nationality: "American", birthDate: "1917-04-25", deathDate: "1996-06-15", roles: ["Vocalist"] },
  { wiki: "Louis_Armstrong", name: "Louis Armstrong", nationality: "American", birthDate: "1901-08-04", deathDate: "1971-07-06", roles: ["Trumpeter", "Vocalist", "Bandleader"] },
  { wiki: "Charlie_Parker", name: "Charlie Parker", nationality: "American", birthDate: "1920-08-29", deathDate: "1955-03-12", roles: ["Saxophonist", "Composer"] },
  { wiki: "Thelonious_Monk", name: "Thelonious Monk", nationality: "American", birthDate: "1917-10-10", deathDate: "1982-02-17", roles: ["Pianist", "Composer"] },
  { wiki: "Billie_Holiday", name: "Billie Holiday", nationality: "American", birthDate: "1915-04-07", deathDate: "1959-07-17", roles: ["Vocalist"] },
  { wiki: "Dave_Brubeck", name: "Dave Brubeck", nationality: "American", birthDate: "1920-12-06", deathDate: "2012-12-05", roles: ["Pianist", "Composer"] },
  { wiki: "Dizzy_Gillespie", name: "Dizzy Gillespie", nationality: "American", birthDate: "1917-10-21", deathDate: "1993-01-06", roles: ["Trumpeter", "Composer", "Bandleader"] },
  // Folk / Rock / Pop
  { wiki: "Bob_Dylan", name: "Bob Dylan", nationality: "American", birthDate: "1941-05-24", roles: ["Singer-Songwriter", "Musician", "Poet"] },
  { wiki: "Yo-Yo_Ma", name: "Yo-Yo Ma", nationality: "American", birthDate: "1955-10-07", roles: ["Cellist"] },
  { wiki: "Itzhak_Perlman", name: "Itzhak Perlman", nationality: "Israeli-American", birthDate: "1945-08-31", roles: ["Violinist", "Conductor"] },
  { wiki: "Lang_Lang", name: "Lang Lang", nationality: "Chinese", birthDate: "1982-06-14", roles: ["Pianist"] },
  { wiki: "Martha_Argerich", name: "Martha Argerich", nationality: "Argentine", birthDate: "1941-06-05", roles: ["Pianist"] },
  { wiki: "Andrés_Segovia", name: "Andrés Segovia", nationality: "Spanish", birthDate: "1893-02-21", deathDate: "1987-06-02", roles: ["Guitarist"] },
];

const INSTRUMENT_ENTRIES = [
  { wiki: "Piano", name: "Piano", family: "Keyboard", tuning: "Equal temperament (A4 = 440Hz)", range: "A0–C8 (88 keys)", origin: "Italy, c. 1700" },
  { wiki: "Violin", name: "Violin", family: "Strings", tuning: "G3-D4-A4-E5", range: "G3–A7", origin: "Italy, 16th century" },
  { wiki: "Classical_guitar", name: "Classical Guitar", family: "Strings", tuning: "E2-A2-D3-G3-B3-E4", range: "E2–B5", origin: "Spain, 15th century" },
  { wiki: "Electric_guitar", name: "Electric Guitar", family: "Strings", tuning: "E2-A2-D3-G3-B3-E4", range: "E2–E6+", origin: "United States, 1930s" },
  { wiki: "Cello", name: "Cello", family: "Strings", tuning: "C2-G2-D3-A3", range: "C2–E6", origin: "Italy, 16th century" },
  { wiki: "Viola", name: "Viola", family: "Strings", tuning: "C3-G3-D4-A4", range: "C3–E6", origin: "Italy, 16th century" },
  { wiki: "Double_bass", name: "Double Bass", family: "Strings", tuning: "E1-A1-D2-G2", range: "E1–G4", origin: "Europe, 15th century" },
  { wiki: "Harp", name: "Harp", family: "Strings", tuning: "C♭ major (concert)", range: "C♭1–G♯7", origin: "Ancient Mesopotamia" },
  { wiki: "Western_concert_flute", name: "Flute", family: "Woodwinds", tuning: "Concert pitch (C)", range: "C4–D7", origin: "Europe (ancient)" },
  { wiki: "Clarinet", name: "Clarinet", family: "Woodwinds", tuning: "B♭ (standard)", range: "D3–B♭6", origin: "Germany, c. 1700" },
  { wiki: "Oboe", name: "Oboe", family: "Woodwinds", tuning: "Concert pitch (C)", range: "B♭3–A6", origin: "France, 17th century" },
  { wiki: "Bassoon", name: "Bassoon", family: "Woodwinds", tuning: "Concert pitch (C)", range: "B♭1–E5", origin: "Italy, 16th century" },
  { wiki: "Saxophone", name: "Saxophone", family: "Woodwinds", tuning: "B♭ or E♭", range: "A♭3–E6 (alto)", origin: "Belgium, 1840s" },
  { wiki: "Trumpet", name: "Trumpet", family: "Brass", tuning: "B♭", range: "F♯3–D6", origin: "Ancient civilizations" },
  { wiki: "French_horn", name: "French Horn", family: "Brass", tuning: "F / B♭ (double horn)", range: "B1–F5", origin: "Germany, 17th century" },
  { wiki: "Trombone", name: "Trombone", family: "Brass", tuning: "B♭ (tenor)", range: "E2–F5", origin: "Europe, 15th century" },
  { wiki: "Tuba", name: "Tuba", family: "Brass", tuning: "B♭ / C / E♭ / F", range: "D1–B♭4", origin: "Germany, 1835" },
  { wiki: "Drum_kit", name: "Drum Kit", family: "Percussion", tuning: "Variable", range: "Unpitched", origin: "United States, early 1900s" },
  { wiki: "Timpani", name: "Timpani", family: "Percussion", tuning: "Pedal-tuned", range: "D2–C4", origin: "Middle East (ancient)" },
  { wiki: "Marimba", name: "Marimba", family: "Percussion", tuning: "Equal temperament", range: "C2–C7", origin: "Central America / Africa" },
  { wiki: "Pipe_organ", name: "Pipe Organ", family: "Keyboard", tuning: "Various temperaments", range: "C2–C7+", origin: "Ancient Greece (hydraulis)" },
  { wiki: "Harpsichord", name: "Harpsichord", family: "Keyboard", tuning: "Various temperaments", range: "F1–F6 (varies)", origin: "Europe, 14th century" },
  { wiki: "Accordion", name: "Accordion", family: "Keyboard/Free reed", tuning: "Equal temperament", range: "Varies by type", origin: "Austria, 1829" },
  { wiki: "Banjo", name: "Banjo", family: "Strings", tuning: "Various (open G common)", range: "D3–A5", origin: "Africa / Americas, 17th century" },
  { wiki: "Mandolin", name: "Mandolin", family: "Strings", tuning: "G3-D4-A4-E5", range: "G3–A6+", origin: "Italy, 18th century" },
  { wiki: "Ukulele", name: "Ukulele", family: "Strings", tuning: "G4-C4-E4-A4 (re-entrant)", range: "C4–A5", origin: "Hawaii, 1880s" },
  { wiki: "Sitar", name: "Sitar", family: "Strings", tuning: "Variable (raga-based)", range: "~3 octaves", origin: "India, 13th century" },
  { wiki: "Erhu", name: "Erhu", family: "Strings", tuning: "D4-A4", range: "D4–D7", origin: "China, Tang Dynasty" },
  { wiki: "Recorder_(musical_instrument)", name: "Recorder", family: "Woodwinds", tuning: "C or F", range: "C5–D7 (soprano)", origin: "Europe, medieval" },
];

const COMPOSITION_ENTRIES = [
  { wiki: "The_Four_Seasons_(Vivaldi)", title: "The Four Seasons", year: 1725, period: "Baroque", keySignature: "Various", difficulty: "Advanced", genre: "baroque", composer: "antonio-vivaldi" },
  { wiki: "Symphony_No._5_(Beethoven)", title: "Symphony No. 5", year: 1808, period: "Classical/Romantic", keySignature: "C minor", difficulty: "Advanced", genre: "classical", composer: "ludwig-van-beethoven" },
  { wiki: "Clair_de_lune_(Debussy)", title: "Clair de Lune", year: 1890, period: "Impressionist", keySignature: "D♭ major", difficulty: "Intermediate", genre: "classical", composer: "claude-debussy" },
  { wiki: "Nocturnes,_Op._9_(Chopin)", title: "Nocturne Op. 9 No. 2", year: 1832, period: "Romantic", keySignature: "E♭ major", difficulty: "Intermediate", genre: "romantic", composer: "frederic-chopin" },
  { wiki: "The_Well-Tempered_Clavier", title: "The Well-Tempered Clavier", year: 1722, period: "Baroque", keySignature: "All 24 keys", difficulty: "Advanced", genre: "baroque", composer: "johann-sebastian-bach" },
  { wiki: "Swan_Lake", title: "Swan Lake", year: 1876, period: "Romantic", keySignature: "Various", difficulty: "Advanced", genre: "romantic", composer: "pyotr-ilyich-tchaikovsky" },
  { wiki: "Kind_of_Blue", title: "Kind of Blue", year: 1959, period: "Modern Jazz", keySignature: "Various (modal)", difficulty: "Advanced", genre: "jazz", composer: "miles-davis" },
  { wiki: "Rhapsody_in_Blue", title: "Rhapsody in Blue", year: 1924, period: "Modern", keySignature: "B♭ major", difficulty: "Advanced", genre: "jazz" },
  { wiki: "Canon_(Pachelbel)", title: "Canon in D", year: 1680, period: "Baroque", keySignature: "D major", difficulty: "Intermediate", genre: "baroque" },
  { wiki: "A_Love_Supreme", title: "A Love Supreme", year: 1965, period: "Modern Jazz", keySignature: "Various", difficulty: "Advanced", genre: "jazz", composer: "john-coltrane" },
  { wiki: "Für_Elise", title: "Für Elise", year: 1810, period: "Classical/Romantic", keySignature: "A minor", difficulty: "Beginner", genre: "classical", composer: "ludwig-van-beethoven" },
  { wiki: "The_Nutcracker", title: "The Nutcracker", year: 1892, period: "Romantic", keySignature: "Various", difficulty: "Advanced", genre: "romantic", composer: "pyotr-ilyich-tchaikovsky" },
  { wiki: "Symphony_No._9_(Beethoven)", title: "Symphony No. 9 (Choral)", year: 1824, period: "Romantic", keySignature: "D minor", difficulty: "Advanced", genre: "classical", composer: "ludwig-van-beethoven" },
  { wiki: "Prelude_in_C_sharp_minor_(Rachmaninoff)", title: "Prelude in C♯ minor", year: 1892, period: "Romantic", keySignature: "C♯ minor", difficulty: "Advanced", genre: "romantic", composer: "sergei-rachmaninoff" },
  { wiki: "Moonlight_Sonata", title: "Moonlight Sonata", year: 1801, period: "Classical/Romantic", keySignature: "C♯ minor", difficulty: "Advanced", genre: "classical", composer: "ludwig-van-beethoven" },
  { wiki: "Boléro", title: "Boléro", year: 1928, period: "Modern", keySignature: "C major", difficulty: "Advanced", genre: "classical", composer: "maurice-ravel" },
  { wiki: "The_Rite_of_Spring", title: "The Rite of Spring", year: 1913, period: "Modern", keySignature: "Various", difficulty: "Advanced", genre: "classical", composer: "igor-stravinsky" },
  { wiki: "Messiah_(Handel)", title: "Messiah", year: 1741, period: "Baroque", keySignature: "Various", difficulty: "Advanced", genre: "baroque", composer: "george-frideric-handel" },
  { wiki: "Hungarian_Rhapsody_No._2", title: "Hungarian Rhapsody No. 2", year: 1847, period: "Romantic", keySignature: "C♯ minor", difficulty: "Advanced", genre: "romantic", composer: "franz-liszt" },
  { wiki: "Symphony_No._40_(Mozart)", title: "Symphony No. 40", year: 1788, period: "Classical", keySignature: "G minor", difficulty: "Advanced", genre: "classical", composer: "wolfgang-amadeus-mozart" },
  { wiki: "Goldberg_Variations", title: "Goldberg Variations", year: 1741, period: "Baroque", keySignature: "G major", difficulty: "Advanced", genre: "baroque", composer: "johann-sebastian-bach" },
  { wiki: "Peer_Gynt_(Grieg)", title: "Peer Gynt Suite", year: 1875, period: "Romantic", keySignature: "Various", difficulty: "Intermediate", genre: "romantic", composer: "edvard-grieg" },
  { wiki: "La_bohème", title: "La Bohème", year: 1896, period: "Romantic", keySignature: "Various", difficulty: "Advanced", genre: "opera", composer: "giacomo-puccini" },
  { wiki: "Ride_of_the_Valkyries", title: "Ride of the Valkyries", year: 1870, period: "Romantic", keySignature: "B minor", difficulty: "Advanced", genre: "opera", composer: "richard-wagner" },
  { wiki: "Dvořák%27s_Symphony_No._9", title: "New World Symphony", year: 1893, period: "Romantic", keySignature: "E minor", difficulty: "Advanced", genre: "romantic", composer: "antonin-dvorak" },
  { wiki: "Take_Five", title: "Take Five", year: 1959, period: "Modern Jazz", keySignature: "E♭ minor", difficulty: "Intermediate", genre: "jazz", composer: "dave-brubeck" },
];

const GENRE_ENTRIES = [
  { wiki: "Classical_music", name: "Classical", era: "1750–1820" },
  { wiki: "Baroque_music", name: "Baroque", era: "1600–1750" },
  { wiki: "Romantic_music", name: "Romantic", era: "1820–1900" },
  { wiki: "Jazz", name: "Jazz", era: "1900–present" },
  { wiki: "Blues", name: "Blues", era: "1870s–present" },
  { wiki: "Rock_music", name: "Rock", era: "1950s–present" },
  { wiki: "Pop_music", name: "Pop", era: "1950s–present" },
  { wiki: "Electronic_music", name: "Electronic", era: "1960s–present" },
  { wiki: "Folk_music", name: "Folk", era: "Traditional–present" },
  { wiki: "Rhythm_and_blues", name: "R&B", era: "1940s–present" },
  { wiki: "Opera", name: "Opera", era: "1600–present" },
  { wiki: "Chamber_music", name: "Chamber Music", era: "1600–present" },
  { wiki: "Impressionism_in_music", name: "Impressionism", era: "1875–1925" },
  { wiki: "Bebop", name: "Bebop", era: "1940s–1960s" },
  { wiki: "Bossa_nova", name: "Bossa Nova", era: "1950s–present" },
  { wiki: "Flamenco", name: "Flamenco", era: "18th century–present" },
  { wiki: "Ragtime", name: "Ragtime", era: "1895–1920" },
  { wiki: "Gospel_music", name: "Gospel", era: "1920s–present" },
  { wiki: "Country_music", name: "Country", era: "1920s–present" },
  { wiki: "World_music", name: "World Music", era: "1980s–present" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("🌐 Importing rich wiki data from Wikipedia...");
  console.log("⏳ Waiting 60s for Wikipedia rate limit cooldown...\n");
  await sleep(60000);
  let stats = { genres: 0, instruments: 0, artists: 0, compositions: 0, failed: 0 };

  // ── 1. Genres ──────────────────────────────────────────────────────────────
  console.log("🎶 Genres...");
  const genreIdMap = {};
  for (const g of GENRE_ENTRIES) {
    const extract = await fetchWikiExtract(g.wiki, 3900);
    await sleep(2000);
    const slug = slugify(g.name);
    const data = { name: g.name, era: g.era };
    if (extract) data.description = extract;
    const id = await getOrCreate("wiki_genres", slug, data, g.name);
    genreIdMap[slug] = id;
    stats.genres++;
  }

  // Set parent genres
  const parentMap = { "chamber-music": "classical", "opera": "classical", "bebop": "jazz", "bossa-nova": "jazz", "ragtime": "jazz", "impressionism": "classical", "gospel": "folk" };
  for (const [child, parent] of Object.entries(parentMap)) {
    if (genreIdMap[child] && genreIdMap[parent]) {
      try {
        await databases.updateDocument(DB, "wiki_genres", genreIdMap[child], { parentGenreId: genreIdMap[parent] });
      } catch {}
    }
  }

  // ── 2. Instruments ─────────────────────────────────────────────────────────
  console.log("\n🎸 Instruments...");
  for (const inst of INSTRUMENT_ENTRIES) {
    const extract = await fetchWikiExtract(inst.wiki, 3900);
    const summary = await fetchWikiSummary(inst.wiki);
    await sleep(2000);
    const slug = slugify(inst.name);
    const data = {
      name: inst.name, family: inst.family, tuning: inst.tuning,
      range: inst.range, origin: inst.origin,
    };
    if (extract) data.description = extract;
    if (summary?.imageUrl) data.imageUrl = summary.imageUrl;
    await getOrCreate("wiki_instruments", slug, data, inst.name);
    stats.instruments++;
  }

  // ── 3. Artists ─────────────────────────────────────────────────────────────
  console.log("\n👤 Artists...");
  const artistIdMap = {};
  for (const a of ARTIST_ENTRIES) {
    const extract = await fetchWikiExtract(a.wiki, 15000);
    const summary = await fetchWikiSummary(a.wiki);
    await sleep(2000);
    const slug = slugify(a.name);
    const data = {
      name: a.name, nationality: a.nationality,
      birthDate: a.birthDate, roles: a.roles,
    };
    if (a.deathDate) data.deathDate = a.deathDate;
    if (extract) data.bio = extract;
    if (summary?.imageUrl) data.imageUrl = summary.imageUrl;
    const id = await getOrCreate("wiki_artists", slug, data, a.name);
    artistIdMap[slug] = id;
    stats.artists++;
  }

  // ── 4. Compositions ────────────────────────────────────────────────────────
  console.log("\n🎼 Compositions...");
  for (const comp of COMPOSITION_ENTRIES) {
    const extract = await fetchWikiExtract(comp.wiki, 3900);
    await sleep(2000);
    const slug = slugify(comp.title);
    const data = {
      title: comp.title, year: comp.year, period: comp.period,
      keySignature: comp.keySignature, difficulty: comp.difficulty,
    };
    if (extract) data.description = extract;
    if (comp.genre && genreIdMap[comp.genre]) data.genreId = genreIdMap[comp.genre];
    if (comp.composer && artistIdMap[comp.composer]) {
      data.composerIds = [artistIdMap[comp.composer]];
    }
    await getOrCreate("wiki_compositions", slug, data, comp.title);
    stats.compositions++;
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   ${stats.genres} genres, ${stats.instruments} instruments, ${stats.artists} artists, ${stats.compositions} compositions`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
