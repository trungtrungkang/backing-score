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

  // Primary Boolean Intersection
  if (isLenient) {
    allMatched = false;
    for (const n of targetPitches) {
      if (pressedPitches.has(n)) {
        allMatched = true;
        break;
      }
    }
  } else {
    for (const n of targetPitches) {
      if (!pressedPitches.has(n)) {
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
