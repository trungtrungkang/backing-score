/**
 * Resolves the physical (printed sheet) measure index from a latent (playback) measure index.
 * The measureMap is SPARSE: only anchor points where the offset changes are stored.
 * E.g. { 21: 5 } means latent 21→physical 5, latent 22→physical 6, latent 23→physical 7, etc.
 * until the next anchor point.
 */
export function getPhysicalMeasure(latent: number, measureMap?: Record<number, number>): number {
  if (!measureMap) return latent;

  // Direct hit
  if (measureMap[latent] !== undefined) return measureMap[latent];

  // Find nearest lower anchor point
  let bestAnchorLatent = -1;
  for (const key of Object.keys(measureMap)) {
    const k = Number(key);
    if (k <= latent && k > bestAnchorLatent) {
      bestAnchorLatent = k;
    }
  }

  if (bestAnchorLatent === -1) return latent; // No anchor below → identity
  return measureMap[bestAnchorLatent] + (latent - bestAnchorLatent);
}

/**
 * Derives the active Latent Measure natively from a continuous unrolled Timemap intersecting bounded timestamps.
 */
export function getMeasureForTime(timemap: { timeMs: number; measure: number }[], timeMs: number): number {
  if (!timemap || timemap.length === 0) return 0;
  for (let i = 0; i < timemap.length; i++) {
    if (i === timemap.length - 1) return timemap[i].measure;
    if (timeMs >= timemap[i].timeMs && timeMs < timemap[i + 1].timeMs) {
      return timemap[i].measure;
    }
  }
  return 0;
}

/**
 * Returns sub-measure beat position from a continuous timemap with optional beatTimestamps.
 * When beatTimestamps are present, uses recorded per-beat timestamps for accurate interpolation.
 * Falls back to even division by beatsPerMeasure when beatTimestamps are absent.
 */
export function getBeatForTime(
  timemap: { timeMs: number; measure: number; beatTimestamps?: number[] }[],
  timeMs: number,
  beatsPerMeasure = 4
): { measure: number; beatIndex: number; fraction: number } {
  if (!timemap || timemap.length === 0) return { measure: 0, beatIndex: 0, fraction: 0 };

  // Find the timemap index for the current measure
  let tmIdx = 0;
  for (let i = 0; i < timemap.length; i++) {
    if (i === timemap.length - 1) { tmIdx = i; break; }
    if (timeMs >= timemap[i].timeMs && timeMs < timemap[i + 1].timeMs) { tmIdx = i; break; }
  }

  const entry = timemap[tmIdx];
  const beats = entry.beatTimestamps;

  if (beats && beats.length > 0) {
    // Use recorded beat timestamps
    for (let i = beats.length - 1; i >= 0; i--) {
      if (timeMs >= beats[i]) {
        const beatStart = beats[i];
        const beatEnd = beats[i + 1] ?? timemap[tmIdx + 1]?.timeMs ?? beatStart;
        const duration = beatEnd - beatStart;
        const fraction = duration > 0 ? Math.min(1, (timeMs - beatStart) / duration) : 0;
        return { measure: entry.measure, beatIndex: i, fraction };
      }
    }
    return { measure: entry.measure, beatIndex: 0, fraction: 0 };
  }

  // Fallback: even division
  const measureStart = entry.timeMs;
  const measureEnd = timemap[tmIdx + 1]?.timeMs ?? measureStart;
  const measureDuration = measureEnd - measureStart;
  if (measureDuration <= 0) return { measure: entry.measure, beatIndex: 0, fraction: 0 };

  const elapsed = timeMs - measureStart;
  const beatDuration = measureDuration / beatsPerMeasure;
  const beatIndex = Math.min(beatsPerMeasure - 1, Math.floor(elapsed / beatDuration));
  const beatStart = beatIndex * beatDuration;
  const fraction = Math.min(1, (elapsed - beatStart) / beatDuration);
  return { measure: entry.measure, beatIndex, fraction };
}

/**
 * Validates hardware active MIDI pitches against parsed Tone.js AST matrices.
 * Evaluates Lenient/Strict threshold intersections alongside repeated identical-chord release-latching.
 */
export function evaluateWaitModeMatch(
  pressedPitches: Set<number>,
  targetPitches: Set<number>,
  isLenient: boolean,
  previousTargetPitches?: Set<number>,
  releasedPitches?: Set<number>
): { allMatched: boolean; isAllowedEarly: boolean } {
  if (!targetPitches || targetPitches.size === 0) {
    return { allMatched: false, isAllowedEarly: false };
  }
  
  let allMatched = pressedPitches.size > 0 && targetPitches.size > 0;

  /**
   * Check if a pressed pitch matches a target pitch with ±1 octave tolerance.
   * This compensates for mic-based pitch detection which often detects the wrong octave
   * (e.g. A2 instead of A3) due to missing fundamentals through laptop microphones.
   */
  const pitchMatchesWithOctaveTolerance = (pressed: number, target: number): boolean => {
    if (pressed === target) return true;
    // Same pitch class (e.g. A2 matches A3, A4 matches A3) — within ±1 octave
    if (pressed % 12 === target % 12 && Math.abs(pressed - target) <= 12) return true;
    return false;
  };

  // Helper to check if any pressed pitch matches a target (with octave tolerance)
  const hasPitchMatch = (pressedPitches: Set<number>, target: number): boolean => {
    if (pressedPitches.has(target)) return true;
    for (const p of pressedPitches) {
      if (pitchMatchesWithOctaveTolerance(p, target)) return true;
    }
    return false;
  };

  // Primary Boolean Intersection
  if (isLenient) {
    allMatched = false;
    for (const n of targetPitches) {
      if (hasPitchMatch(pressedPitches, n)) {
        allMatched = true;
        break;
      }
    }
  } else {
    for (const n of targetPitches) {
      if (!hasPitchMatch(pressedPitches, n)) {
        allMatched = false;
        break;
      }
    }
  }

  // Identical Consecutive Chord "Release Latching" logic
  let isAllowedEarly = true;
  let identicalToPrevious = false;

  if (previousTargetPitches && previousTargetPitches.size === targetPitches.size) {
    identicalToPrevious = Array.from(targetPitches).every((n) => previousTargetPitches.has(n));
  }

  if (identicalToPrevious && previousTargetPitches && releasedPitches) {
    // Flag pitches released correctly into the state object by reference natively!
    previousTargetPitches.forEach((n) => {
      if (!pressedPitches.has(n)) {
        releasedPitches.add(n);
      }
    });

    const allReleased = Array.from(previousTargetPitches).every((n) => releasedPitches.has(n));
    isAllowedEarly = allReleased || Array.from(pressedPitches).length === 0;
  }

  return { allMatched, isAllowedEarly };
}
