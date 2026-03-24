import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { analyzeMusicXML } from "@/lib/score/musicxml-analyzer";
import { getPhysicalMeasure } from "@/lib/score/math";

// ─── Helper: build a minimal MusicXML string ─────────────────────────

function buildMusicXML(opts: {
  measures: Array<{
    timeSig?: string;
    tempo?: number;
    repeatFwd?: boolean;
    repeatBack?: boolean;
    endingStart?: number;
    endingStop?: boolean;
    endingDiscontinue?: boolean;
    implicit?: boolean;
    number?: string;
  }>;
  keySig?: { fifths: number; mode?: string };
}): string {
  const keySig = opts.keySig || { fifths: 0, mode: "major" };
  let prevTimeSig = "4/4";
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">`;

  opts.measures.forEach((m, idx) => {
    const mNum = m.number || `${idx + 1}`;
    const implicit = m.implicit ? ` implicit="yes"` : "";
    xml += `<measure number="${mNum}"${implicit}>`;

    // Attributes (key sig only in first measure, time sig where specified)
    if (idx === 0 || m.timeSig) {
      xml += `<attributes>`;
      if (idx === 0) {
        xml += `<divisions>1</divisions>`;
        xml += `<key><fifths>${keySig.fifths}</fifths><mode>${keySig.mode || "major"}</mode></key>`;
      }
      if (m.timeSig) {
        const [b, bt] = m.timeSig.split("/");
        xml += `<time><beats>${b}</beats><beat-type>${bt}</beat-type></time>`;
      } else if (idx === 0) {
        xml += `<time><beats>4</beats><beat-type>4</beat-type></time>`;
      }
      xml += `</attributes>`;
    }

    // Left barline (repeat forward, ending start)
    if (m.repeatFwd || m.endingStart !== undefined) {
      xml += `<barline location="left">`;
      if (m.endingStart !== undefined) xml += `<ending number="${m.endingStart}" type="start"/>`;
      if (m.repeatFwd) xml += `<repeat direction="forward"/>`;
      xml += `</barline>`;
    }

    // Tempo
    if (m.tempo) {
      xml += `<direction><sound tempo="${m.tempo}"/></direction>`;
    }

    // Compute full measure duration: divisions=1, so duration = beats * (4/beatType)
    const curTimeSig = m.timeSig || (idx === 0 ? "4/4" : prevTimeSig);
    const [cb, cbt] = curTimeSig.split("/").map(Number);
    const fullDuration = (cb || 4) * (4 / (cbt || 4));  // in divisions (= quarter notes when divisions=1)
    prevTimeSig = curTimeSig;

    // A note filling the full measure (prevents false anacrusis detection)
    xml += `<note><pitch><step>C</step><octave>4</octave></pitch><duration>${fullDuration}</duration><voice>1</voice><type>quarter</type></note>`;

    // Right barline (repeat backward, ending stop/discontinue)
    if (m.repeatBack || m.endingStop || m.endingDiscontinue) {
      xml += `<barline location="right">`;
      if (m.endingStop) xml += `<ending number="1" type="stop"/>`;
      if (m.endingDiscontinue) xml += `<ending number="2" type="discontinue"/>`;
      if (m.repeatBack) xml += `<repeat direction="backward"/>`;
      xml += `</barline>`;
    }

    xml += `</measure>`;
  });

  xml += `</part></score-partwise>`;
  return xml;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("analyzeMusicXML – basic metadata extraction", () => {
  it("extracts tempo, time signature, and key signature", () => {
    const xml = buildMusicXML({
      measures: [
        { tempo: 100, timeSig: "3/4" },
        {},
        {},
      ],
      keySig: { fifths: -2, mode: "minor" },
    });
    const result = analyzeMusicXML(xml);
    expect(result.tempo).toBe(100);
    expect(result.timeSignature).toBe("3/4");
    expect(result.keySignature).toBe("G Min");
    expect(result.totalMeasures).toBe(3);
  });

  it("uses defaults when no explicit metadata", () => {
    const xml = buildMusicXML({ measures: [{}] });
    const result = analyzeMusicXML(xml);
    expect(result.tempo).toBe(120); // default
    expect(result.timeSignature).toBe("4/4"); // default
    expect(result.keySignature).toBe("C Maj"); // 0 fifths
  });
});

describe("analyzeMusicXML – simple repeat (no volta)", () => {
  it("generates correct playback sequence for simple repeat", () => {
    // M1 M2(repeat fwd) M3 M4(repeat back) M5
    const xml = buildMusicXML({
      measures: [
        { tempo: 120 },
        { repeatFwd: true },
        {},
        { repeatBack: true },
        {},
      ],
    });
    const result = analyzeMusicXML(xml);
    // Expected playback: 1, 2, 3, 4, 2, 3, 4, 5 = 8 measures
    expect(result.totalPlaybackMeasures).toBe(8);

    // Verify physical mapping
    const physical = result.timemap.map(t => getPhysicalMeasure(t.measure, result.measureMap));
    expect(physical).toEqual([1, 2, 3, 4, 2, 3, 4, 5]);
  });
});

describe("analyzeMusicXML – volta/ending handling", () => {
  it("plays ending 1 on first pass, ending 2 on second pass", () => {
    // Structure:
    // M1(repeat fwd) M2 M3 M4(ending 1 start + stop + repeat back) M5(ending 2 start + discontinue) M6
    const xml = buildMusicXML({
      measures: [
        { repeatFwd: true, tempo: 120 },
        {},
        {},
        { endingStart: 1, endingStop: true, repeatBack: true },
        { endingStart: 2, endingDiscontinue: true, implicit: true, number: "X1" },
        {},
      ],
    });
    const result = analyzeMusicXML(xml);
    // Expected: M1, M2, M3, M4(ending1), M1, M2, M3, M5(ending2), M6 = 9
    expect(result.totalPlaybackMeasures).toBe(9);

    const physical = result.timemap.map(t => getPhysicalMeasure(t.measure, result.measureMap));
    expect(physical).toEqual([1, 2, 3, 4, 1, 2, 3, 5, 6]);
  });

  it("sparse measureMap only has anchor points", () => {
    const xml = buildMusicXML({
      measures: [
        { repeatFwd: true, tempo: 120 },
        {},
        {},
        { endingStart: 1, endingStop: true, repeatBack: true },
        { endingStart: 2, endingDiscontinue: true, implicit: true, number: "X1" },
        {},
      ],
    });
    const result = analyzeMusicXML(xml);
    // measureMap should NOT have entries for every single measure
    const anchorCount = Object.keys(result.measureMap).length;
    expect(anchorCount).toBeLessThan(result.totalPlaybackMeasures);
    // Anchor at latent 5 → physical 1 (repeat back to start)
    expect(result.measureMap[5]).toBe(1);
  });
});

describe("analyzeMusicXML – tempo changes", () => {
  it("records tempo changes per measure", () => {
    const xml = buildMusicXML({
      measures: [
        { tempo: 100 },
        {},
        { tempo: 140 },
        {},
      ],
    });
    const result = analyzeMusicXML(xml);

    // timemap should reflect tempo at measure 1 and measure 3
    expect(result.timemap[0].tempo).toBe(100);
    expect(result.timemap[1].tempo).toBeUndefined();
    expect(result.timemap[2].tempo).toBe(140);

    // tempoChanges should have both
    expect(result.tempoChanges.length).toBeGreaterThanOrEqual(2);
  });

  it("calculates accurate timeMs with tempo changes", () => {
    const xml = buildMusicXML({
      measures: [
        { tempo: 120, timeSig: "4/4" }, // 4 beats at 120bpm = 2000ms
        { tempo: 60 },                   // 4 beats at 60bpm = 4000ms
        {},
      ],
    });
    const result = analyzeMusicXML(xml);
    expect(result.timemap[0].timeMs).toBe(0);
    expect(result.timemap[1].timeMs).toBe(2000); // after M1
    expect(result.timemap[2].timeMs).toBe(6000); // after M1 + M2
  });
});

describe("analyzeMusicXML – anacrusis (pickup measure)", () => {
  it("detects pickup measure in Chopin Waltz (3/4, first measure = 1 quarter)", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../../../musicxml-library/chopin/Waltz_in_A_MinorChopin.musicxml"
    );
    const xml = fs.readFileSync(fixturePath, "utf8");
    const result = analyzeMusicXML(xml);

    expect(result.timeSignature).toBe("3/4");
    expect(result.tempo).toBe(120);

    // Measure 1 should be a pickup: only 1 quarter note
    // At 120 BPM, 1 quarter = 500ms, not 1500ms (full 3/4 measure)
    expect(result.timemap[0].timeMs).toBe(0);
    expect(result.timemap[1].timeMs).toBe(500); // pickup = 1 quarter = 500ms
  });

  it("does not false-positive on full first measure", () => {
    // Normal 4/4, first measure is full → should remain 4 quarters
    const xml = buildMusicXML({
      measures: [
        { tempo: 120 },
        {},
      ],
    });
    const result = analyzeMusicXML(xml);
    // 4 beats at 120bpm = 2000ms
    expect(result.timemap[1].timeMs).toBe(2000);
  });
});

describe("analyzeMusicXML – real file: The Entertainer", () => {
  const fixturePath = path.resolve(
    __dirname,
    "../../../../musicxml-library/joplin/The_Entertainer_-_Scott_Joplin_-_1902.musicxml"
  );

  it("parses The Entertainer without errors", () => {
    const xml = fs.readFileSync(fixturePath, "utf8");
    const result = analyzeMusicXML(xml);

    expect(result.tempo).toBeGreaterThan(0);
    expect(result.timeSignature).toBe("2/4");
    expect(result.totalMeasures).toBeGreaterThan(80);
    expect(result.totalPlaybackMeasures).toBeGreaterThan(result.totalMeasures);
  });

  it("has sparse measureMap (fewer entries than playback measures)", () => {
    const xml = fs.readFileSync(fixturePath, "utf8");
    const result = analyzeMusicXML(xml);

    const anchorCount = Object.keys(result.measureMap).length;
    expect(anchorCount).toBeLessThan(result.totalPlaybackMeasures / 2);
  });

  it("correctly handles volta: pass 2 skips ending 1, plays ending 2", () => {
    const xml = fs.readFileSync(fixturePath, "utf8");
    const result = analyzeMusicXML(xml);

    // Section A: M5(repeat) → M20(ending 1) → X1(ending 2)
    // After ending 1 at latent 20, repeat → latent 21→phys 5
    // Then ending 2 at latent 36→phys 21 (X1)
    const phys21 = getPhysicalMeasure(21, result.measureMap);
    expect(phys21).toBe(5); // Repeat back to M5

    const phys36 = getPhysicalMeasure(36, result.measureMap);
    expect(phys36).toBe(21); // Ending 2 (X1)
  });

  it("generates repeat descriptions", () => {
    const xml = fs.readFileSync(fixturePath, "utf8");
    const result = analyzeMusicXML(xml);
    expect(result.repeatDescriptions.length).toBeGreaterThan(0);
  });
});
