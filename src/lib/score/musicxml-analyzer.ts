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
  /** Tempo if changed at or within this measure */
  tempo?: number;
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

    // Time signature changes
    const attrs = measure.getElementsByTagName("attributes");
    for (let a = 0; a < attrs.length; a++) {
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

    // Sound elements (tempo, navigation)
    const directions = measure.getElementsByTagName("direction");
    for (let d = 0; d < directions.length; d++) {
      const sounds = directions[d].getElementsByTagName("sound");
      for (let s = 0; s < sounds.length; s++) {
        const sound = sounds[s];
        const tempo = sound.getAttribute("tempo");
        if (tempo) {
          const bpm = parseFloat(tempo);
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

  const uniqueTempoChanges = tempoChanges.filter((tc, i) => {
    if (i === 0) return true;
    return tc[1] !== tempoChanges[i - 1][1] || tc[0] !== tempoChanges[i - 1][0];
  });

  return {
    tempo: initialTempo,
    timeSignature: initialTimeSig,
    keySignature,
    timemap,
    measureMap,
    totalMeasures: physicalCounter,
    totalPlaybackMeasures: timemap.length,
    tempoChanges: uniqueTempoChanges,
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
  let latentMeasure = 1;

  let repeatStartIdx = 0;
  const repeatCounts = new Map<number, number>();
  let currentPass = 1;
  let jumped = false;

  // Sparse anchor tracking: only emit measureMap entries when offset changes
  let lastAnchorLatent = 1;
  let lastAnchorPhysical = 1;

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

    // Update tempo/time sig
    if (m.tempo !== undefined) currentTempo = m.tempo;
    if (m.timeSignature) currentTimeSig = m.timeSignature;

    // Track repeat forward position
    if (m.repeatForward) {
      // Only update the start index, but DON'T reset currentPass here.
      // currentPass is managed by the repeat backward handler.
      // Resetting here would break volta skipping on pass 2+.
      repeatStartIdx = i;
    }

    // Calculate duration
    const msPerQuarterNote = 60000 / currentTempo;
    const measureDurationMs = m.durationInQuarters * msPerQuarterNote;

    // Build timemap entry
    const entry: TimemapEntry = { measure: latentMeasure, timeMs: accumulatedTimeMs };
    if (m.timeSignature || (latentMeasure === 1 && currentTimeSig !== "4/4")) {
      entry.timeSignature = m.timeSignature || currentTimeSig;
    }
    if (latentMeasure === 1) {
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
