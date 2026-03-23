/**
 * Inject <midi-instrument> tags into MusicXML so Verovio generates MIDI
 * with correct instrument sounds instead of defaulting everything to Piano.
 *
 * Many MusicXML files (especially from music21 corpus) have <score-instrument>
 * but lack the <midi-instrument> that tells the renderer which General MIDI
 * program to use. Without it, everything defaults to program 0 (Piano).
 */
export function injectMidiInstruments(xmlText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const serializer = new XMLSerializer();

  // General MIDI program mapping by part name keywords
  // Program numbers are 1-indexed as per MusicXML spec
  const INSTRUMENT_MAP: [RegExp, number][] = [
    [/piano|keyboard|klavier|pianoforte/i, 1],     // Acoustic Grand Piano
    [/organ|orgel/i, 20],                           // Church Organ
    [/harpsi/i, 7],                                 // Harpsichord
    [/celest/i, 12],                                // Celesta
    [/violin|violine|violino/i, 41],                // Violin
    [/viola/i, 42],                                 // Viola
    [/cello|violoncello/i, 43],                     // Cello
    [/bass(?!oon)|contrabass|double bass|basso/i, 44], // Contrabass
    [/harp|harfe/i, 47],                            // Orchestral Harp
    [/timpani|pauken/i, 48],                        // Timpani
    [/trumpet|trompete|tromba/i, 57],               // Trumpet
    [/trombone|posaune/i, 58],                      // Trombone
    [/tuba/i, 59],                                  // Tuba
    [/horn|corno/i, 61],                            // French Horn
    [/flute|flöte|flauto/i, 74],                    // Flute
    [/oboe|hautbois/i, 69],                         // Oboe
    [/clarinet|klarinette|clarinetto/i, 72],        // Clarinet
    [/bassoon|fagott|fagotto/i, 71],                // Bassoon
    [/soprano|sopran/i, 53],                        // Voice Oohs (Choir)
    [/alto|contralto|alt\b/i, 53],                  // Voice Oohs
    [/tenor/i, 53],                                 // Voice Oohs
    [/guitar|gitarre|chitarra/i, 25],               // Acoustic Guitar (nylon)
    [/recorder|blockflöte/i, 75],                   // Recorder
  ];

  function getMidiProgram(partName: string): number {
    for (const [regex, program] of INSTRUMENT_MAP) {
      if (regex.test(partName)) return program;
    }
    return 1; // Default: Acoustic Grand Piano
  }

  const scoreParts = doc.querySelectorAll("score-part");
  let channel = 1;

  scoreParts.forEach((sp) => {
    const partName = sp.querySelector("part-name")?.textContent || "";
    const scoreInst = sp.querySelector("score-instrument");
    if (!scoreInst) return;

    const instId = scoreInst.getAttribute("id") || "";

    // Skip if midi-instrument already exists
    const existingMidi = sp.querySelector(`midi-instrument[id="${instId}"]`);
    if (existingMidi) return;

    const program = getMidiProgram(partName);

    // Skip channel 10 (reserved for percussion in General MIDI)
    if (channel === 10) channel = 11;
    if (channel > 16) channel = 1;

    const midiInst = doc.createElement("midi-instrument");
    midiInst.setAttribute("id", instId);

    const midiChannel = doc.createElement("midi-channel");
    midiChannel.textContent = String(channel);
    midiInst.appendChild(midiChannel);

    const midiProgram = doc.createElement("midi-program");
    midiProgram.textContent = String(program);
    midiInst.appendChild(midiProgram);

    sp.appendChild(midiInst);
    channel++;
  });

  return serializer.serializeToString(doc);
}

/**
 * General MIDI instrument list organized by category.
 * Program numbers are 1-indexed (MusicXML convention).
 */
export interface GMInstrument {
  program: number;
  name: string;
}

export interface GMCategory {
  category: string;
  instruments: GMInstrument[];
}

export const GM_INSTRUMENTS: GMCategory[] = [
  {
    category: "Piano",
    instruments: [
      { program: 1, name: "Acoustic Grand Piano" },
      { program: 2, name: "Bright Acoustic Piano" },
      { program: 3, name: "Electric Grand Piano" },
      { program: 4, name: "Honky-tonk Piano" },
      { program: 5, name: "Electric Piano 1" },
      { program: 6, name: "Electric Piano 2" },
      { program: 7, name: "Harpsichord" },
      { program: 8, name: "Clavinet" },
    ],
  },
  {
    category: "Chromatic Percussion",
    instruments: [
      { program: 9, name: "Celesta" },
      { program: 10, name: "Glockenspiel" },
      { program: 11, name: "Music Box" },
      { program: 12, name: "Vibraphone" },
      { program: 13, name: "Marimba" },
      { program: 14, name: "Xylophone" },
      { program: 15, name: "Tubular Bells" },
    ],
  },
  {
    category: "Organ",
    instruments: [
      { program: 17, name: "Drawbar Organ" },
      { program: 18, name: "Percussive Organ" },
      { program: 19, name: "Rock Organ" },
      { program: 20, name: "Church Organ" },
      { program: 21, name: "Reed Organ" },
      { program: 22, name: "Accordion" },
      { program: 23, name: "Harmonica" },
    ],
  },
  {
    category: "Guitar",
    instruments: [
      { program: 25, name: "Acoustic Guitar (nylon)" },
      { program: 26, name: "Acoustic Guitar (steel)" },
      { program: 27, name: "Electric Guitar (jazz)" },
      { program: 28, name: "Electric Guitar (clean)" },
      { program: 29, name: "Electric Guitar (muted)" },
      { program: 30, name: "Overdriven Guitar" },
      { program: 31, name: "Distortion Guitar" },
    ],
  },
  {
    category: "Strings",
    instruments: [
      { program: 41, name: "Violin" },
      { program: 42, name: "Viola" },
      { program: 43, name: "Cello" },
      { program: 44, name: "Contrabass" },
      { program: 45, name: "Tremolo Strings" },
      { program: 46, name: "Pizzicato Strings" },
      { program: 47, name: "Orchestral Harp" },
      { program: 48, name: "Timpani" },
      { program: 49, name: "String Ensemble 1" },
      { program: 50, name: "String Ensemble 2" },
      { program: 51, name: "Synth Strings 1" },
      { program: 52, name: "Synth Strings 2" },
    ],
  },
  {
    category: "Vocal / Choir",
    instruments: [
      { program: 53, name: "Choir Aahs" },
      { program: 54, name: "Voice Oohs" },
      { program: 55, name: "Synth Voice" },
    ],
  },
  {
    category: "Brass",
    instruments: [
      { program: 57, name: "Trumpet" },
      { program: 58, name: "Trombone" },
      { program: 59, name: "Tuba" },
      { program: 60, name: "Muted Trumpet" },
      { program: 61, name: "French Horn" },
      { program: 62, name: "Brass Section" },
    ],
  },
  {
    category: "Woodwind",
    instruments: [
      { program: 65, name: "Soprano Sax" },
      { program: 66, name: "Alto Sax" },
      { program: 67, name: "Tenor Sax" },
      { program: 68, name: "Baritone Sax" },
      { program: 69, name: "Oboe" },
      { program: 70, name: "English Horn" },
      { program: 71, name: "Bassoon" },
      { program: 72, name: "Clarinet" },
      { program: 73, name: "Piccolo" },
      { program: 74, name: "Flute" },
      { program: 75, name: "Recorder" },
      { program: 76, name: "Pan Flute" },
    ],
  },
];

/** Get instrument name by GM program number (1-indexed) */
export function getGMInstrumentName(program: number): string {
  for (const cat of GM_INSTRUMENTS) {
    const found = cat.instruments.find(i => i.program === program);
    if (found) return found.name;
  }
  return `Program ${program}`;
}
