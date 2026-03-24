/**
 * MusicXML Auto-Analyzer
 * Parses raw MusicXML string and extracts metadata, repeat structures,
 * and generates timemap + measureMap for playback.
 */

import type { TimemapEntry } from "@/lib/daw/types";

// ─── Key Signature Lookup ────────────────────────────────────────────

const MAJOR_KEYS: Record<number, string> = {
  "-7": "Cb Maj", "-6": "Gb Maj", "-5": "Db Maj", "-4": "Ab Maj",
  "-3": "Eb Maj", "-2": "Bb Maj", "-1": "F Maj", "0": "C Maj",
  "1": "G Maj", "2": "D Maj", "3": "A Maj", "4": "E Maj",
  "5": "B Maj", "6": "F# Maj", "7": "C# Maj",
};
const MINOR_KEYS: Record<number, string> = {
  "-7": "Ab Min", "-6": "Eb Min", "-5": "Bb Min", "-4": "F Min",
  "-3": "C Min", "-2": "G Min", "-1": "D Min", "0": "A Min",
  "1": "E Min", "2": "B Min", "3": "F# Min", "4": "C# Min",
  "5": "G# Min", "6": "D# Min", "7": "A# Min",
};

// ─── Parsed Measure Structures ──────────────────────────────────────

interface MeasureInfo {
  /** Sequential physical measure number (1-based) */
  number: number;
  /** Original MusicXML measure number attribute (for display) */
  originalLabel: string;
  /** Array index in the measures list */
  index: number;
  /** Time signature if changed at this measure */
  timeSignature?: string;
  /** Last tempo if changed at or within this measure (outgoing tempo for next measure) */
  tempo?: number;
  /** First tempo change in this measure (for duration calculation) */
  firstTempo?: number;
  /** Beat duration sum in quarter-note units */
  durationInQuarters: number;
  /** Repeat forward barline */
  repeatForward?: boolean;
  /** Repeat backward barline with times count */
  repeatBackward?: number;
  /** Ending/volta start info on this measure */
  endingStart?: number; // ending number (1, 2, ...)
  /** Ending/volta stop/discontinue on this measure */
  endingStop?: boolean;
  /** Navigation jumps */
  dacapo?: boolean;
  dalsegno?: string;
  segno?: string;
  coda?: string;
  tocoda?: string;
  fine?: boolean;
}

/** Ending region: contiguous span of measures belonging to one volta bracket */
interface EndingRegion {
  startIdx: number;
  endIdx: number;
  endingNumber: number;
}

export interface MusicXMLAnalysis {
  tempo: number;
  timeSignature: string;
  keySignature: string;
  timemap: TimemapEntry[];
  measureMap: Record<number, number>;
  totalMeasures: number;
  totalPlaybackMeasures: number;
  tempoChanges: [number, number][];
  repeatDescriptions: string[];
}

// ─── XML Helpers ─────────────────────────────────────────────────────

function getTextContent(parent: Element, tagName: string): string | null {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() ?? null;
}

function getNumericContent(parent: Element, tagName: string): number | null {
  const text = getTextContent(parent, tagName);
  if (text === null) return null;
  const n = parseFloat(text);
  return isNaN(n) ? null : n;
}

// ─── Main Analyzer ───────────────────────────────────────────────────

export function analyzeMusicXML(xmlText: string): MusicXMLAnalysis {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const parseError = doc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    throw new Error("Invalid MusicXML: " + (parseError[0].textContent || "parse error"));
  }

  let initialTempo = 120;
  let initialTimeSig = "4/4";
  let keySignature = "C Maj";

  const parts = doc.getElementsByTagName("part");
  if (parts.length === 0) throw new Error("No <part> found in MusicXML");
  const firstPart = parts[0];
  const measures = firstPart.getElementsByTagName("measure");
  if (measures.length === 0) throw new Error("No measures found in MusicXML");

  // Parse first measure for initial attributes
  const firstMeasure = measures[0];
  const attributes = firstMeasure.getElementsByTagName("attributes")[0];
  if (attributes) {
    const keyEl = attributes.getElementsByTagName("key")[0];
    if (keyEl) {
      const fifths = getNumericContent(keyEl, "fifths");
      const mode = getTextContent(keyEl, "mode");
      if (fifths !== null) {
        keySignature = (mode === "minor" ? MINOR_KEYS : MAJOR_KEYS)[fifths]
          || `${fifths} fifths (${mode || "major"})`;
      }
    }
    const timeEl = attributes.getElementsByTagName("time")[0];
    if (timeEl) {
      const beats = getTextContent(timeEl, "beats");
      const beatType = getTextContent(timeEl, "beat-type");
      if (beats && beatType) initialTimeSig = `${beats}/${beatType}`;
    }
  }

  // Find initial tempo
  const allSounds = firstMeasure.getElementsByTagName("sound");
  for (let s = 0; s < allSounds.length; s++) {
    const t = allSounds[s].getAttribute("tempo");
    if (t) { initialTempo = parseFloat(t); break; }
  }

  // ── Parse ALL measures ──
  const measureInfos: MeasureInfo[] = [];
  let currentBeats = parseInt(initialTimeSig.split("/")[0]) || 4;
  let currentBeatType = parseInt(initialTimeSig.split("/")[1]) || 4;
  let currentDivisions = 1; // divisions per quarter note
  const tempoChanges: [number, number][] = [[1, initialTempo]];
  let physicalCounter = 0;

  for (let m = 0; m < measures.length; m++) {
    const measure = measures[m];
    const rawLabel = measure.getAttribute("number") || `${m + 1}`;
    const isImplicit = measure.getAttribute("implicit") === "yes";
    physicalCounter++;
    const physNum = physicalCounter;

    const info: MeasureInfo = {
      number: physNum,
      originalLabel: rawLabel,
      index: m,
      durationInQuarters: currentBeats * (4 / currentBeatType),
    };

    // Time signature and divisions changes
    const attrs = measure.getElementsByTagName("attributes");
    for (let a = 0; a < attrs.length; a++) {
      const divEl = attrs[a].getElementsByTagName("divisions")[0];
      if (divEl && divEl.textContent) {
        currentDivisions = parseInt(divEl.textContent) || 1;
      }
      const timeEl = attrs[a].getElementsByTagName("time")[0];
      if (timeEl) {
        const beats = getTextContent(timeEl, "beats");
        const beatType = getTextContent(timeEl, "beat-type");
        if (beats && beatType) {
          currentBeats = parseInt(beats);
          currentBeatType = parseInt(beatType);
          info.timeSignature = `${beats}/${beatType}`;
          info.durationInQuarters = currentBeats * (4 / currentBeatType);
        }
      }
    }

    // ── Partial measure detection: compute actual note duration ──
    // If a measure has fewer note divisions than expected, use the actual duration.
    // Applies to pickups (anacrusis), section boundaries, and mid-piece partial measures.
    {
      const expectedDurationInDivisions = info.durationInQuarters * currentDivisions;
      const notes = measure.getElementsByTagName("note");
      // Sum durations per voice, taking the voice with the most content
      const voiceDurations: Record<string, number> = {};
      for (let n = 0; n < notes.length; n++) {
        const note = notes[n];
        // Skip chord notes (they overlap with the previous note, not additive)
        if (note.getElementsByTagName("chord").length > 0) continue;
        // Skip grace notes (no duration)
        if (note.getElementsByTagName("grace").length > 0) continue;
        const durEl = note.getElementsByTagName("duration")[0];
        if (!durEl || !durEl.textContent) continue;
        const dur = parseInt(durEl.textContent) || 0;
        const voice = getTextContent(note, "voice") || "1";
        voiceDurations[voice] = (voiceDurations[voice] || 0) + dur;
      }
      const maxVoiceDuration = Math.max(0, ...Object.values(voiceDurations));
      if (maxVoiceDuration > 0 && maxVoiceDuration < expectedDurationInDivisions) {
        info.durationInQuarters = maxVoiceDuration / currentDivisions;
      }
    }

    // Sound elements (tempo, navigation)
    const directions = measure.getElementsByTagName("direction");
    for (let d = 0; d < directions.length; d++) {
      const sounds = directions[d].getElementsByTagName("sound");
      for (let s = 0; s < sounds.length; s++) {
        const sound = sounds[s];
        const tempo = sound.getAttribute("tempo");
        if (tempo) {
          const bpm = parseFloat(tempo);
          if (info.firstTempo === undefined) info.firstTempo = bpm;
          info.tempo = bpm;
          if (m > 0 || tempoChanges.length === 0 || tempoChanges[tempoChanges.length - 1][1] !== bpm) {
            tempoChanges.push([physNum, bpm]);
          }
        }
        if (sound.getAttribute("dacapo") === "yes") info.dacapo = true;
        if (sound.getAttribute("dalsegno")) info.dalsegno = sound.getAttribute("dalsegno")!;
        if (sound.getAttribute("segno")) info.segno = sound.getAttribute("segno")!;
        if (sound.getAttribute("coda")) info.coda = sound.getAttribute("coda")!;
        if (sound.getAttribute("tocoda")) info.tocoda = sound.getAttribute("tocoda")!;
        if (sound.getAttribute("fine") === "yes") info.fine = true;
      }
    }

    // Barlines: repeats and endings
    const barlines = measure.getElementsByTagName("barline");
    for (let b = 0; b < barlines.length; b++) {
      const barline = barlines[b];
      const repeatEl = barline.getElementsByTagName("repeat")[0];
      if (repeatEl) {
        const dir = repeatEl.getAttribute("direction");
        if (dir === "forward") info.repeatForward = true;
        if (dir === "backward") {
          info.repeatBackward = parseInt(repeatEl.getAttribute("times") || "2", 10);
        }
      }
      const endingEl = barline.getElementsByTagName("ending")[0];
      if (endingEl) {
        const endType = endingEl.getAttribute("type") || "start";
        const endNum = parseInt(endingEl.getAttribute("number") || "1", 10);
        if (endType === "start") {
          info.endingStart = endNum;
        } else {
          info.endingStop = true;
        }
      }
    }

    measureInfos.push(info);
  }

  // ── Build ending regions ──
  const endingRegions: EndingRegion[] = [];
  for (let i = 0; i < measureInfos.length; i++) {
    const m = measureInfos[i];
    if (m.endingStart !== undefined) {
      let endIdx = i;
      for (let j = i; j < measureInfos.length; j++) {
        if (measureInfos[j].endingStop || (j > i && measureInfos[j].endingStart !== undefined)) {
          endIdx = measureInfos[j].endingStop ? j : j - 1;
          break;
        }
        endIdx = j;
      }
      endingRegions.push({ startIdx: i, endIdx, endingNumber: m.endingStart });
    }
  }

  // ── Unroll playback sequence ──
  const { timemap, measureMap, repeatDescriptions } = unrollMeasures(
    measureInfos, endingRegions, initialTempo, initialTimeSig
  );

  // Derive tempoChanges from timemap (uses correct latent numbering aligned with sheet music)
  const derivedTempoChanges: [number, number][] = timemap
    .filter(t => t.tempo !== undefined)
    .map(t => [t.measure, t.tempo!] as [number, number]);

  return {
    tempo: initialTempo,
    timeSignature: initialTimeSig,
    keySignature,
    timemap,
    measureMap,
    totalMeasures: physicalCounter,
    totalPlaybackMeasures: timemap.length,
    tempoChanges: derivedTempoChanges,
    repeatDescriptions,
  };
}

// ─── Unroll Algorithm ────────────────────────────────────────────────

function unrollMeasures(
  measures: MeasureInfo[],
  endingRegions: EndingRegion[],
  initialTempo: number,
  initialTimeSig: string,
): {
  timemap: TimemapEntry[];
  measureMap: Record<number, number>;
  repeatDescriptions: string[];
} {
  const timemap: TimemapEntry[] = [];
  const measureMap: Record<number, number> = {};
  const repeatDescriptions: string[] = [];

  // Helper: find ending region at a given array index
  function getEndingRegionAt(idx: number): EndingRegion | null {
    for (const r of endingRegions) {
      if (idx >= r.startIdx && idx <= r.endIdx) return r;
    }
    return null;
  }

  // Find navigation markers by array index
  const segnoIdxMap: Record<string, number> = {};
  const codaIdxMap: Record<string, number> = {};
  let fineIdx: number | null = null;

  for (let i = 0; i < measures.length; i++) {
    if (measures[i].segno) segnoIdxMap[measures[i].segno!] = i;
    if (measures[i].coda) codaIdxMap[measures[i].coda!] = i;
    if (measures[i].fine) fineIdx = i;
  }

  let currentTempo = initialTempo;
  let currentTimeSig = initialTimeSig;
  let accumulatedTimeMs = 0;

  // Detect if first measure is a pickup (anacrusis):
  // its actual duration is shorter than a full measure per the time signature
  const firstMeasureFullDuration = parseInt(initialTimeSig.split("/")[0]) * (4 / parseInt(initialTimeSig.split("/")[1]));
  const hasPickup = measures.length > 0 && measures[0].durationInQuarters < firstMeasureFullDuration;

  // If pickup: latent starts at 0 (pickup = measure 0, first full measure = 1)
  // This aligns latent numbers with the sheet music measure numbering.
  let latentMeasure = hasPickup ? 0 : 1;

  let repeatStartIdx = 0;
  const repeatCounts = new Map<number, number>();
  let currentPass = 1;
  let jumped = false;

  // Sparse anchor tracking: only emit measureMap entries when offset changes
  let lastAnchorLatent = hasPickup ? 0 : 1;
  let lastAnchorPhysical = 1;
  // Pickup anchor: latent 0 → physical 1 (first SVG element)
  if (hasPickup) {
    measureMap[0] = 1;
  }

  let i = 0;
  const maxIterations = measures.length * 10;
  let iterations = 0;

  while (i < measures.length && iterations < maxIterations) {
    iterations++;
    const m = measures[i];

    // ── Check if entering an ending region ──
    const region = getEndingRegionAt(i);
    if (region && i === region.startIdx && region.endingNumber !== currentPass) {
      // Skip entire ending region — not our pass
      i = region.endIdx + 1;
      continue;
    }

    // Calculate duration using firstTempo if available (the tempo at measure start),
    // otherwise use the incoming tempo from the previous measure.
    // For rit. (200→190→170→140), firstTempo = 190 → use 190 for duration, exit at 140.
    // For a single tempo (Più mosso = 200), firstTempo = 200 → use 200 for duration.
    if (m.timeSignature) currentTimeSig = m.timeSignature;
    const tempoForDuration = m.firstTempo ?? currentTempo;
    const msPerQuarterNote = 60000 / tempoForDuration;
    const measureDurationMs = m.durationInQuarters * msPerQuarterNote;

    // Update currentTempo to last tempo in this measure (outgoing for next measure)
    if (m.tempo !== undefined) currentTempo = m.tempo;

    // Track repeat forward position
    if (m.repeatForward) {
      repeatStartIdx = i;
    }

    // Build timemap entry
    const isFirstEntry = timemap.length === 0;
    const entry: TimemapEntry = {
      measure: latentMeasure,
      timeMs: accumulatedTimeMs,
      durationInQuarters: m.durationInQuarters,
    };
    if (m.timeSignature || (isFirstEntry && currentTimeSig !== "4/4")) {
      entry.timeSignature = m.timeSignature || currentTimeSig;
    }
    if (isFirstEntry) {
      entry.timeSignature = entry.timeSignature || currentTimeSig;
      entry.tempo = initialTempo;
    }
    if (m.tempo !== undefined) entry.tempo = m.tempo;
    timemap.push(entry);

    // Map latent → physical: only emit ANCHOR points where offset changes
    const expectedPhysical = lastAnchorPhysical + (latentMeasure - lastAnchorLatent);
    if (m.number !== expectedPhysical) {
      measureMap[latentMeasure] = m.number;
      lastAnchorLatent = latentMeasure;
      lastAnchorPhysical = m.number;
    }

    accumulatedTimeMs += measureDurationMs;
    latentMeasure++;

    // ── Handle repeat backward ──
    if (m.repeatBackward !== undefined) {
      const playCount = repeatCounts.get(i) || 1;
      const maxPlays = m.repeatBackward;

      if (playCount < maxPlays) {
        repeatCounts.set(i, playCount + 1);
        currentPass = playCount + 1;
        if (playCount === 1) {
          repeatDescriptions.push(
            `M${measures[repeatStartIdx].number}-${m.number}: Repeat ×${maxPlays}`
          );
        }
        i = repeatStartIdx;
        continue;
      } else {
        repeatCounts.delete(i);
        currentPass = 1;
      }
    }

    // Navigation jumps
    if (!jumped) {
      if (m.dacapo) {
        jumped = true;
        repeatDescriptions.push(`M${m.number}: D.C.${fineIdx !== null ? ` al Fine (M${measures[fineIdx].number})` : ""}`);
        i = 0; continue;
      }
      if (m.dalsegno) {
        const sIdx = segnoIdxMap[m.dalsegno];
        if (sIdx !== undefined) {
          jumped = true;
          repeatDescriptions.push(`M${m.number}: D.S.`);
          i = sIdx; continue;
        }
      }
      if (m.tocoda) {
        const cIdx = codaIdxMap[m.tocoda];
        if (cIdx !== undefined) {
          repeatDescriptions.push(`M${m.number}: To Coda → M${measures[cIdx].number}`);
          i = cIdx; continue;
        }
      }
    }

    if (jumped && m.fine) break;
    i++;
  }

  return { timemap, measureMap, repeatDescriptions };
}
