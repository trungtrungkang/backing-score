#!/usr/bin/env node
/**
 * Seed wiki collections with curated music encyclopedia data.
 * Imports: artists, instruments, genres, compositions.
 *
 * Run: node scripts/seed-wiki-data.mjs
 */

import "dotenv/config";
import { config } from "dotenv";
import { Client, Databases, ID, Permission, Role, Query } from "node-appwrite";

config({ path: ".env.local", override: true });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

const PERMS = [Permission.read(Role.any())];

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function exists(collectionId, slug) {
  try {
    const { documents } = await databases.listDocuments(DB, collectionId, [
      Query.equal("slug", slug), Query.limit(1),
    ]);
    return documents.length > 0;
  } catch { return false; }
}

async function upsert(collectionId, data, label) {
  const slug = data.slug || slugify(data.name || data.title);
  data.slug = slug;
  if (await exists(collectionId, slug)) {
    console.log(`  ↳ exists: ${label}`);
    return;
  }
  await databases.createDocument(DB, collectionId, ID.unique(), data, PERMS);
  console.log(`  ✓ ${label}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const GENRES = [
  { name: "Classical", slug: "classical", era: "1750–1820", description: "<p>Classical music is a broad term encompassing Western art music from the medieval period to the present. It is characterized by its complex structures, rich harmonies, and the use of orchestral and chamber ensembles.</p><p>The classical period specifically (1750–1820) saw the works of Mozart, Haydn, and early Beethoven, emphasizing clarity, balance, and formal structure.</p>" },
  { name: "Baroque", slug: "baroque", era: "1600–1750", description: "<p>Baroque music is characterized by ornamental melodic lines, the use of basso continuo, and the development of tonal harmony. Key forms include the concerto, sonata, suite, and opera.</p><p>Composers like Bach, Handel, and Vivaldi defined this era with intricate counterpoint and dramatic expression.</p>" },
  { name: "Romantic", slug: "romantic", era: "1820–1900", description: "<p>Romantic music expanded the emotional range and formal structures of the Classical period. It emphasized individual expression, nationalism, and programmatic storytelling through music.</p><p>The era produced monumental symphonies, virtuosic concertos, and intimate character pieces by composers like Chopin, Liszt, Brahms, and Tchaikovsky.</p>" },
  { name: "Jazz", slug: "jazz", era: "1900–present", description: "<p>Jazz originated in the African-American communities of New Orleans in the early 20th century, blending African rhythms, blues, ragtime, and European harmony. It is defined by swing, blue notes, call-and-response, polyrhythms, and improvisation.</p><p>Jazz has evolved through many styles: Dixieland, swing, bebop, cool jazz, hard bop, free jazz, fusion, and contemporary jazz.</p>" },
  { name: "Blues", slug: "blues", era: "1870s–present", description: "<p>Blues is the foundation of much American popular music. Originating from African-American work songs and spirituals in the rural South, it typically follows a 12-bar chord progression and features expressive vocal and instrumental techniques.</p>" },
  { name: "Rock", slug: "rock", era: "1950s–present", description: "<p>Rock music emerged in the 1950s, rooted in rock and roll, blues, and country music. It is characterized by a strong backbeat, electric guitars, bass guitar, and drums.</p>" },
  { name: "Pop", slug: "pop", era: "1950s–present", description: "<p>Pop music is characterized by catchy melodies, simple harmonies, and broad commercial appeal. Drawing from various genres including rock, dance, R&B, and electronic music.</p>" },
  { name: "Electronic", slug: "electronic", era: "1960s–present", description: "<p>Electronic music employs electronic instruments, digital technology, and computer-based production. From early synthesizer experiments to modern EDM, it spans ambient, techno, house, drum and bass, dubstep, and more.</p>" },
  { name: "Folk", slug: "folk", era: "Traditional–present", description: "<p>Folk music encompasses traditional songs and melodies passed down through oral tradition. It reflects cultural identity, storytelling, and social commentary.</p>" },
  { name: "R&B", slug: "r-and-b", era: "1940s–present", description: "<p>Rhythm and Blues combines elements of jazz, gospel, and blues. R&B has evolved from jump blues through soul, funk, quiet storm, new jack swing, and contemporary R&B.</p>" },
  { name: "Opera", slug: "opera", era: "1600–present", description: "<p>Opera is a dramatic art form combining vocal and orchestral music with acting, sets, and costumes. Originating in Italy around 1600, opera encompasses many styles from baroque opera seria to modern works.</p>" },
  { name: "Chamber Music", slug: "chamber-music", era: "1600–present", description: "<p>Chamber music is composed for small ensembles with one performer per part, originally intended for intimate settings. String quartets, piano trios, and wind quintets are among the most common forms.</p>" },
];

const INSTRUMENTS = [
  { name: "Piano", slug: "piano", family: "Keyboard", tuning: "Equal temperament (A4 = 440Hz)", range: "A0–C8 (88 keys)", origin: "Italy, 1700", description: "<p>The piano is one of the most versatile and widely played instruments. Invented by Bartolomeo Cristofori around 1700, it produces sound by hammers striking steel strings when keys are pressed.</p><p>The piano's 88 keys span over 7 octaves, making it suitable for virtually every genre.</p>" },
  { name: "Violin", slug: "violin", family: "Strings", tuning: "G3-D4-A4-E5 (perfect fifths)", range: "G3–A7 (4+ octaves)", origin: "Italy, 16th century", description: "<p>The violin is the smallest and highest-pitched member of the string family. Its four strings are played with a bow or plucked, producing a warm, expressive tone capable of extraordinary agility.</p>" },
  { name: "Guitar", slug: "guitar", family: "Strings", tuning: "E2-A2-D3-G3-B3-E4 (standard)", range: "E2–E6 (4 octaves)", origin: "Spain, 15th century", description: "<p>The guitar is one of the most popular instruments worldwide, used across virtually every genre from classical and flamenco to rock, blues, jazz, and pop.</p>" },
  { name: "Cello", slug: "cello", family: "Strings", tuning: "C2-G2-D3-A3 (perfect fifths)", range: "C2–E6 (4+ octaves)", origin: "Italy, 16th century", description: "<p>The cello is known for its rich, warm tone that closely resembles the human voice. It serves as both a melodic and harmonic voice in orchestras, chamber music, and as a solo instrument.</p>" },
  { name: "Flute", slug: "flute", family: "Woodwinds", tuning: "Concert pitch (C)", range: "C4–D7 (3 octaves)", origin: "Europe / Global (ancient)", description: "<p>The modern concert flute is a transverse instrument made of metal, producing a clear, bright tone. One of the oldest instruments in human history, with specimens dating back over 40,000 years.</p>" },
  { name: "Trumpet", slug: "trumpet", family: "Brass", tuning: "B♭ (standard orchestral)", range: "F♯3–D6 (2.5 octaves)", origin: "Ancient civilizations", description: "<p>The trumpet is the highest-pitched brass instrument, known for its brilliant, penetrating tone. Used in orchestras, concert bands, jazz ensembles, and popular music.</p>" },
  { name: "Drums", slug: "drums", family: "Percussion", tuning: "Variable", range: "Unpitched (various timbres)", origin: "Global (prehistoric)", description: "<p>The drum kit is a collection of drums and cymbals played by a single musician. It is the rhythmic backbone of virtually every popular music genre.</p>" },
  { name: "Saxophone", slug: "saxophone", family: "Woodwinds", tuning: "B♭ (tenor/soprano) or E♭ (alto/baritone)", range: "A♭3–E6 (2.5 octaves, alto)", origin: "Belgium, 1840s", description: "<p>The saxophone was invented by Adolphe Sax in the 1840s. It combines a single-reed mouthpiece with a brass body, producing a powerful, versatile tone. The defining voice of jazz.</p>" },
  { name: "Clarinet", slug: "clarinet", family: "Woodwinds", tuning: "B♭ (standard) or A", range: "D3–B♭6 (3.5 octaves)", origin: "Germany, early 1700s", description: "<p>The clarinet is a single-reed woodwind with a warm, rich tone and one of the widest pitch ranges of any wind instrument. Essential in orchestral, chamber, and jazz music.</p>" },
  { name: "Double Bass", slug: "double-bass", family: "Strings", tuning: "E1-A1-D2-G2 (fourths)", range: "E1–G4 (3+ octaves)", origin: "Europe, 15th century", description: "<p>The double bass is the largest and lowest-pitched bowed string instrument. It provides the harmonic foundation in orchestras and jazz groups, where it is often played pizzicato.</p>" },
  { name: "Harp", slug: "harp", family: "Strings", tuning: "C♭ major (concert harp)", range: "C♭1–G♯7 (6.5 octaves)", origin: "Ancient Mesopotamia", description: "<p>The concert harp has 47 strings and 7 foot pedals allowing it to play in any key. Its ethereal, shimmering tone makes it a staple of orchestral music.</p>" },
  { name: "Organ", slug: "organ", family: "Keyboard", tuning: "Equal temperament or historical", range: "C2–C7+ (multiple manuals)", origin: "Ancient Greece (hydraulis)", description: "<p>The pipe organ is one of the most complex and powerful instruments ever built, using pressurized air through pipes. The 'King of Instruments' has been central to Western sacred music for over a millennium.</p>" },
];

const ARTISTS = [
  { name: "Johann Sebastian Bach", slug: "johann-sebastian-bach", nationality: "German", birthDate: "1685-03-31", deathDate: "1750-07-28", roles: ["Composer", "Organist"], bio: "<p><strong>Johann Sebastian Bach</strong> (1685–1750) is widely regarded as one of the greatest composers in Western music history. A master of counterpoint, harmony, and musical form, Bach's work represents the pinnacle of the Baroque era.</p><p>Key works include the <em>Brandenburg Concertos</em>, <em>The Well-Tempered Clavier</em>, the <em>Mass in B minor</em>, and the <em>St Matthew Passion</em>.</p>" },
  { name: "Ludwig van Beethoven", slug: "ludwig-van-beethoven", nationality: "German", birthDate: "1770-12-17", deathDate: "1827-03-26", roles: ["Composer", "Pianist"], bio: "<p><strong>Ludwig van Beethoven</strong> (1770–1827) bridged the Classical and Romantic eras, transforming virtually every musical form he touched. His gradual loss of hearing makes his later masterpieces all the more extraordinary.</p><p>Iconic works include the <em>Eroica</em> and <em>Ninth</em> symphonies, the <em>Moonlight Sonata</em>, and the late string quartets.</p>" },
  { name: "Wolfgang Amadeus Mozart", slug: "wolfgang-amadeus-mozart", nationality: "Austrian", birthDate: "1756-01-27", deathDate: "1791-12-05", roles: ["Composer", "Pianist", "Violinist"], bio: "<p><strong>Wolfgang Amadeus Mozart</strong> (1756–1791) was a child prodigy who produced over 800 works in 35 years, including 41 symphonies, 27 piano concertos, and operas such as <em>The Marriage of Figaro</em>, <em>Don Giovanni</em>, and <em>The Magic Flute</em>.</p>" },
  { name: "Frédéric Chopin", slug: "frederic-chopin", nationality: "Polish", birthDate: "1810-03-01", deathDate: "1849-10-17", roles: ["Composer", "Pianist"], bio: "<p><strong>Frédéric Chopin</strong> (1810–1849) is universally recognized as the poet of the piano. He composed almost exclusively for solo piano, creating nocturnes, études, preludes, waltzes, mazurkas, polonaises, and ballades that are cornerstones of the repertoire.</p>" },
  { name: "Claude Debussy", slug: "claude-debussy", nationality: "French", birthDate: "1862-08-22", deathDate: "1918-03-25", roles: ["Composer", "Pianist"], bio: "<p><strong>Claude Debussy</strong> (1862–1918) is often called the father of musical Impressionism. His innovative use of harmony, color, and texture broke from traditional tonal structures.</p><p>Masterworks include <em>Prélude à l'après-midi d'un faune</em>, <em>La Mer</em>, and <em>Clair de Lune</em>.</p>" },
  { name: "Pyotr Ilyich Tchaikovsky", slug: "pyotr-ilyich-tchaikovsky", nationality: "Russian", birthDate: "1840-05-07", deathDate: "1893-11-06", roles: ["Composer", "Conductor"], bio: "<p><strong>Tchaikovsky</strong> (1840–1893) is Russia's most celebrated composer. His ballets — <em>Swan Lake</em>, <em>The Nutcracker</em>, and <em>Sleeping Beauty</em> — are the most performed in the world.</p>" },
  { name: "Antonio Vivaldi", slug: "antonio-vivaldi", nationality: "Italian", birthDate: "1678-03-04", deathDate: "1741-07-28", roles: ["Composer", "Violinist", "Priest"], bio: "<p><strong>Antonio Vivaldi</strong> (1678–1741), the \"Red Priest,\" was a Venetian Baroque master. He composed over 500 concertos. His <em>The Four Seasons</em> is one of the most recognizable pieces in all of classical music.</p>" },
  { name: "Franz Schubert", slug: "franz-schubert", nationality: "Austrian", birthDate: "1797-01-31", deathDate: "1828-11-19", roles: ["Composer"], bio: "<p><strong>Franz Schubert</strong> (1797–1828) left behind over 1,500 works despite dying at 31. He is particularly renowned for his 600+ art songs (Lieder) that elevated the genre to new heights.</p>" },
  { name: "Miles Davis", slug: "miles-davis", nationality: "American", birthDate: "1926-05-26", deathDate: "1991-09-28", roles: ["Trumpeter", "Composer", "Bandleader"], bio: "<p><strong>Miles Davis</strong> (1926–1991) was at the forefront of nearly every major jazz development — bebop, cool jazz, modal jazz, and fusion. <em>Kind of Blue</em> is the best-selling jazz album of all time.</p>" },
  { name: "Duke Ellington", slug: "duke-ellington", nationality: "American", birthDate: "1899-04-29", deathDate: "1974-05-24", roles: ["Composer", "Pianist", "Bandleader"], bio: "<p><strong>Duke Ellington</strong> (1899–1974) is considered one of America's greatest composers. Leading his orchestra for nearly 50 years, he composed thousands of pieces. Iconic works include <em>Take the A Train</em> and <em>Mood Indigo</em>.</p>" },
  { name: "John Coltrane", slug: "john-coltrane", nationality: "American", birthDate: "1926-09-23", deathDate: "1967-07-17", roles: ["Saxophonist", "Composer"], bio: "<p><strong>John Coltrane</strong> (1926–1967) was a transformative force in jazz. Albums like <em>A Love Supreme</em> and <em>Giant Steps</em> are essential recordings in the jazz canon.</p>" },
  { name: "Ella Fitzgerald", slug: "ella-fitzgerald", nationality: "American", birthDate: "1917-04-25", deathDate: "1996-06-15", roles: ["Vocalist"], bio: "<p><strong>Ella Fitzgerald</strong> (1917–1996), the \"First Lady of Song,\" possessed one of the most beautiful voices in music history. Her <em>Songbook</em> series are definitive interpretations of the Great American Songbook.</p>" },
  { name: "Bob Dylan", slug: "bob-dylan", nationality: "American", birthDate: "1941-05-24", roles: ["Singer-Songwriter", "Musician", "Poet"], bio: "<p><strong>Bob Dylan</strong> (born 1941) redefined what popular music could express. Awarded the Nobel Prize in Literature in 2016, he is the only songwriter to receive the honor.</p>" },
  { name: "Louis Armstrong", slug: "louis-armstrong", nationality: "American", birthDate: "1901-08-04", deathDate: "1971-07-06", roles: ["Trumpeter", "Vocalist", "Bandleader"], bio: "<p><strong>Louis Armstrong</strong> (1901–1971) was the most important figure in the development of jazz. His innovations in improvisation, swing feel, and trumpet technique fundamentally shaped the music.</p>" },
  { name: "Johann Strauss II", slug: "johann-strauss-ii", nationality: "Austrian", birthDate: "1825-10-25", deathDate: "1899-06-03", roles: ["Composer", "Conductor"], bio: "<p><strong>Johann Strauss II</strong> (1825–1899), the \"Waltz King,\" composed over 500 dance pieces. His <em>The Blue Danube</em> is one of the most recognized pieces in the world.</p>" },
];

const COMPOSITIONS = [
  { title: "The Four Seasons", slug: "the-four-seasons", year: 1725, period: "Baroque", keySignature: "Various", difficulty: "Advanced", description: "<p>A set of four violin concertos by Vivaldi, each depicting a season. Perhaps the most famous work of the Baroque era.</p>" },
  { title: "Symphony No. 5", slug: "symphony-no-5-beethoven", year: 1808, period: "Classical/Romantic", keySignature: "C minor", difficulty: "Advanced", description: "<p>Beethoven's Fifth Symphony is one of the most iconic compositions in Western music. Its famous four-note opening motif pervades the entire work.</p>" },
  { title: "Clair de Lune", slug: "clair-de-lune", year: 1890, period: "Impressionist", keySignature: "D♭ major", difficulty: "Intermediate", description: "<p>The third movement of Debussy's <em>Suite bergamasque</em>, \"Clair de Lune\" is one of the most beloved piano pieces ever written.</p>" },
  { title: "Nocturne Op. 9 No. 2", slug: "nocturne-op-9-no-2", year: 1832, period: "Romantic", keySignature: "E♭ major", difficulty: "Intermediate", description: "<p>Chopin's most famous nocturne — a lyrical night piece that epitomizes Romantic piano poetry.</p>" },
  { title: "The Well-Tempered Clavier", slug: "the-well-tempered-clavier", year: 1722, period: "Baroque", keySignature: "All 24 keys", difficulty: "Advanced", description: "<p>Bach's monumental collection of preludes and fugues in all 24 major and minor keys — a cornerstone of Western keyboard music.</p>" },
  { title: "Swan Lake", slug: "swan-lake", year: 1876, period: "Romantic", keySignature: "Various", difficulty: "Advanced", description: "<p>Tchaikovsky's most famous ballet, with sweeping melodies and emotional depth that revolutionized ballet music.</p>" },
  { title: "Kind of Blue", slug: "kind-of-blue", year: 1959, period: "Modern", keySignature: "Various (modal)", difficulty: "Advanced", description: "<p>Miles Davis's <em>Kind of Blue</em> is the best-selling jazz album of all time and a watershed moment in music history.</p>" },
  { title: "Rhapsody in Blue", slug: "rhapsody-in-blue", year: 1924, period: "Modern", keySignature: "B♭ major", difficulty: "Advanced", description: "<p>Gershwin's groundbreaking orchestral work fusing classical music with jazz elements, capturing the energy of 1920s America.</p>" },
  { title: "Canon in D", slug: "canon-in-d", year: 1680, period: "Baroque", keySignature: "D major", difficulty: "Intermediate", description: "<p>Pachelbel's Canon in D — one of the most recognized pieces of classical music, widely played at weddings and ceremonies.</p>" },
  { title: "A Love Supreme", slug: "a-love-supreme", year: 1965, period: "Modern", keySignature: "Various", difficulty: "Advanced", description: "<p>John Coltrane's four-part suite expressing spiritual devotion through music. Considered one of the greatest albums in any genre.</p>" },
  { title: "Für Elise", slug: "fur-elise", year: 1810, period: "Classical/Romantic", keySignature: "A minor", difficulty: "Beginner", description: "<p>Beethoven's beloved bagatelle — one of the most recognizable piano pieces in the world and often the first classical piece beginners learn.</p>" },
  { title: "The Nutcracker", slug: "the-nutcracker", year: 1892, period: "Romantic", keySignature: "Various", difficulty: "Advanced", description: "<p>Tchaikovsky's enchanting ballet has become synonymous with Christmas celebrations worldwide, featuring iconic melodies like the \"Dance of the Sugar Plum Fairy.\"</p>" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("🎵 Seeding Music Encyclopedia data...\n");

  // 1. Genres
  console.log("🎶 Genres...");
  const genreIdMap = {};
  for (const g of GENRES) {
    await upsert("wiki_genres", g, g.name);
    await sleep(200);
  }
  const { documents: genreDocs } = await databases.listDocuments(DB, "wiki_genres", [Query.limit(50)]);
  for (const doc of genreDocs) genreIdMap[doc.slug] = doc.$id;

  // Set parent genres
  const parentMap = { "chamber-music": "classical", "opera": "classical" };
  for (const [child, parent] of Object.entries(parentMap)) {
    if (genreIdMap[child] && genreIdMap[parent]) {
      try {
        await databases.updateDocument(DB, "wiki_genres", genreIdMap[child], { parentGenreId: genreIdMap[parent] });
        console.log(`  ↳ set parent: ${child} → ${parent}`);
      } catch {}
    }
  }

  // 2. Instruments
  console.log("\n🎸 Instruments...");
  for (const inst of INSTRUMENTS) {
    await upsert("wiki_instruments", inst, inst.name);
    await sleep(200);
  }

  // 3. Artists
  console.log("\n👤 Artists...");
  for (const a of ARTISTS) {
    await upsert("wiki_artists", a, a.name);
    await sleep(200);
  }

  // 4. Compositions
  console.log("\n🎼 Compositions...");
  const compositionGenreMap = {
    "the-four-seasons": "baroque", "symphony-no-5-beethoven": "classical",
    "clair-de-lune": "classical", "nocturne-op-9-no-2": "romantic",
    "the-well-tempered-clavier": "baroque", "swan-lake": "romantic",
    "kind-of-blue": "jazz", "rhapsody-in-blue": "jazz",
    "canon-in-d": "baroque", "a-love-supreme": "jazz",
    "fur-elise": "classical", "the-nutcracker": "romantic",
  };
  for (const comp of COMPOSITIONS) {
    const genreSlug = compositionGenreMap[comp.slug];
    if (genreSlug && genreIdMap[genreSlug]) comp.genreId = genreIdMap[genreSlug];
    await upsert("wiki_compositions", comp, comp.title);
    await sleep(200);
  }

  // 5. Link compositions to artists
  console.log("\n🔗 Linking compositions to artists...");
  const { documents: artistDocs } = await databases.listDocuments(DB, "wiki_artists", [Query.limit(50)]);
  const artistIdMap = {};
  for (const a of artistDocs) artistIdMap[a.slug] = a.$id;

  const composerLinks = {
    "the-four-seasons": ["antonio-vivaldi"],
    "symphony-no-5-beethoven": ["ludwig-van-beethoven"],
    "clair-de-lune": ["claude-debussy"],
    "nocturne-op-9-no-2": ["frederic-chopin"],
    "the-well-tempered-clavier": ["johann-sebastian-bach"],
    "swan-lake": ["pyotr-ilyich-tchaikovsky"],
    "kind-of-blue": ["miles-davis"],
    "a-love-supreme": ["john-coltrane"],
    "fur-elise": ["ludwig-van-beethoven"],
    "the-nutcracker": ["pyotr-ilyich-tchaikovsky"],
  };

  const { documents: compDocs } = await databases.listDocuments(DB, "wiki_compositions", [Query.limit(50)]);
  const compIdMap = {};
  for (const c of compDocs) compIdMap[c.slug] = c.$id;

  for (const [compSlug, artistSlugs] of Object.entries(composerLinks)) {
    const compId = compIdMap[compSlug];
    if (!compId) continue;
    const composerIds = artistSlugs.map(s => artistIdMap[s]).filter(Boolean);
    if (composerIds.length > 0) {
      try {
        await databases.updateDocument(DB, "wiki_compositions", compId, { composerIds });
        console.log(`  ✓ ${compSlug} → ${artistSlugs.join(", ")}`);
      } catch (e) {
        console.log(`  ↳ skip: ${compSlug} (${e.message})`);
      }
    }
  }

  console.log("\n✅ Wiki data seeded successfully!");
  console.log(`   ${GENRES.length} genres, ${INSTRUMENTS.length} instruments, ${ARTISTS.length} artists, ${COMPOSITIONS.length} compositions`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
