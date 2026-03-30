"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { cn, fetchWithRetry } from "@/lib/utils";
import { VerovioWorkerProxy, type IVerovioWorkerProxy } from "@/lib/verovio/worker-proxy";
import { getFileViewUrl } from "@/lib/appwrite";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";

export interface MusicXMLVisualizerProps {
  scoreFileId?: string;
  positionMs?: number;
  /** External ref for live position updates without re-renders (from EditorShell RAF loop) */
  externalPositionMsRef?: React.RefObject<number>;
  isPlaying?: boolean;
  timemap?: TimemapEntry[];
  measureMap?: Record<number, number>;
  onSeek?: (positionMs: number) => void;
  onMidiExtracted?: (midiBase64: string) => void;
  isDarkMode?: boolean;
  isWaitMode?: boolean;
  isWaiting?: boolean;
  practiceTrackIds?: number[];
  onPartNamesExtracted?: (names: string[]) => void;
  timemapSource?: "auto" | "manual";
  className?: string;
  defaultScale?: number;
  payloadTempo?: number;
  playbackRate?: number;
}

import { getPhysicalMeasure } from "@/lib/score/math";
import type { TimemapEntry } from "@/lib/daw/types";
import { injectMidiInstruments } from "@/lib/score/midi-instruments";

export interface VerovioTimemapEntry {
  tstamp: number;
  tempo?: number;
  on?: string[];
  off?: string[];
}


export function MusicXMLVisualizer({
  scoreFileId, positionMs = 0, externalPositionMsRef, isPlaying = false, timemap = [], measureMap, onSeek, onMidiExtracted, onPartNamesExtracted, isDarkMode = false,
  isWaitMode = false, isWaiting = false, practiceTrackIds, timemapSource, className, defaultScale, payloadTempo, playbackRate = 1
}: MusicXMLVisualizerProps) {
  // Store positionMs in a ref to avoid re-renders — playhead uses its own RAF loop
  // If externalPositionMsRef is provided, use it directly (zero-rerender path from EditorShell)
  const internalPositionMsRef = useRef(positionMs);
  if (!externalPositionMsRef) {
    internalPositionMsRef.current = positionMs;
  }
  const positionMsRef = externalPositionMsRef ?? internalPositionMsRef;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0); // increments when SVG is updated
  const svgContentRef = useRef<string | null>(null); // holds raw SVG string
  const svgContainerRef = useRef<HTMLDivElement | null>(null); // DOM node for SVG
  const workerProxyRef = useRef<IVerovioWorkerProxy | null>(null);

  const [processedXml, setProcessedXml] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [debouncedWidth, setDebouncedWidth] = useState<number>(0);

  // Custom DOM refs for playhead
  const containerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const measuresCacheRef = useRef<NodeListOf<Element> | null>(null);
  const localTimemapRef = useRef<VerovioTimemapEntry[] | null>(null);
  const activeNoteElementsRef = useRef<SVGElement[]>([]);
  const [scale, setScale] = useState(40);

  // Load saved zoom level for this score
  useEffect(() => {
    if (!scoreFileId) return;

    // Explicit override for embedded environments (e.g. Tiptap Snippet)
    if (defaultScale !== undefined) {
      setScale(defaultScale);
      return;
    }

    // System default for full-page `/c/[courseId]/[lessonId]` View
    if (window.innerWidth >= 768) {
      setScale(70);
    }
  }, [scoreFileId, defaultScale]);

  // Initialize Worker once
  useEffect(() => {
    if (workerProxyRef.current) return;

    // Use the copied verovio-worker.js from the public directory
    const workerUrl = "/dist/verovio/verovio-worker.js";
    const worker = new Worker(workerUrl);

    // Tell the worker where to load the wasm toolkit from
    worker.postMessage({
      verovioUrl: "https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js"
    });

    const proxy = new VerovioWorkerProxy(worker) as unknown as IVerovioWorkerProxy;
    workerProxyRef.current = proxy;

    // Cleanup worker on unmount
    return () => {
      worker.terminate();
      workerProxyRef.current = null;
    };
  }, []);

  // --- RESIZE OBSERVER ENGINE ---
  useEffect(() => {
    if (!svgContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    observer.observe(svgContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedWidth(containerWidth), 300);
    return () => clearTimeout(timer);
  }, [containerWidth]);

  // --- EFFECT A: DATA FETCH, XML SANITIZATION & MIDI GENERATION (RUNS ONCE PER SCORE) ---
  useEffect(() => {
    if (!scoreFileId || !workerProxyRef.current) return;

    let canceled = false;
    const loadScore = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = getFileViewUrl(scoreFileId);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (canceled) return;

        const proxy = workerProxyRef.current;
        if (!proxy) return;

        // Wait for verovio runtime to be ready
        await proxy.onRuntimeInitialized();
        if (canceled) return;

        // Fix Sibelius 2/4 Whole Rest export bug via Strict DOM Traversal
        const parser = new DOMParser();
        const baseXmlDoc = parser.parseFromString(text, 'text/xml');

        // Extract native part-names for superior Practice UX (fallback to P1, P2)
        const extractedPartNames: string[] = [];
        const scoreParts = baseXmlDoc.getElementsByTagName('score-part');
        for (let i = 0; i < scoreParts.length; i++) {
          const pNameNode = scoreParts[i].getElementsByTagName('part-name')[0];
          extractedPartNames.push(pNameNode && pNameNode.textContent ? pNameNode.textContent.trim() : scoreParts[i].getAttribute('id') || `Part ${i + 1}`);
        }
        if (onPartNamesExtracted && !canceled) {
          onPartNamesExtracted(extractedPartNames);
        }

        // Apply the Whole Rest Fix GLOBALLY so BOTH Visual and MIDI Timemaps synchronize exactly to 3-beat measures natively!
        const baseNotes = baseXmlDoc.getElementsByTagName('note');
        for (let i = 0; i < baseNotes.length; i++) {
          const noteNode = baseNotes[i];
          const restElements = noteNode.getElementsByTagName('rest');
          const hasRest = restElements.length > 0;
          if (hasRest) {
            const types = noteNode.getElementsByTagName('type');
            if (types.length > 0 && types[0].textContent === 'whole') {
              restElements[0].setAttribute("measure", "yes");
              noteNode.removeChild(types[0]);
            }
          }
        }

        // 2. Prevent Verovio VLV Timestamp Cascades by Stripping Corrupt Sibelius <pedal> Tags.
        const directions = baseXmlDoc.getElementsByTagName('direction');
        for (let i = directions.length - 1; i >= 0; i--) {
          const dir = directions[i];
          if (dir.getElementsByTagName('pedal').length > 0) {
            dir.parentNode?.removeChild(dir);
          }
        }

        // 3. Purge infinite <tie> anomalies specifically isolating unclosed boundaries circumventing VLV overflows while retaining valid sustains natively
        const openTies: Record<string, Element[]> = {};
        const baseMeasures = baseXmlDoc.getElementsByTagName('measure');
        // Sequentially validate tied note pairs across all boundaries natively
        for (let i = 0; i < baseMeasures.length; i++) {
          const measure = baseMeasures[i];
          const mNotes = measure.getElementsByTagName('note');
          for (let j = 0; j < mNotes.length; j++) {
            const note = mNotes[j];
            const pitch = note.getElementsByTagName('pitch')[0];
            if (!pitch) continue;

            const step = pitch.getElementsByTagName('step')[0]?.textContent || '';
            const alter = pitch.getElementsByTagName('alter')[0]?.textContent || '';
            const octave = pitch.getElementsByTagName('octave')[0]?.textContent || '';
            const key = `${step}${alter}${octave}`;

            const noteTies = note.getElementsByTagName('tie');
            for (let k = noteTies.length - 1; k >= 0; k--) {
              const tie = noteTies[k];
              const tieType = tie.getAttribute('type');
              if (tieType === 'start') {
                if (!openTies[key]) openTies[key] = [];
                openTies[key].push(tie);
              } else if (tieType === 'stop') {
                if (openTies[key] && openTies[key].length > 0) {
                  openTies[key].pop(); // Successfully closed
                } else {
                  tie.parentNode?.removeChild(tie); // Malformed stop without start natively
                }
              }
            }
          }
        }

        // Final Sweep: Purge any trailing unclosed 'start' ties triggering infinite VLV extrapolations globally!
        for (const key of Object.keys(openTies)) {
          for (const tie of openTies[key]) {
            tie.parentNode?.removeChild(tie);
          }
        }

        const serializer = new XMLSerializer();
        const safeSvgText = serializer.serializeToString(baseXmlDoc);

        // Output the finalized clean document to absolute state for fast Render passes
        setProcessedXml(safeSvgText);

        // --- ISOLATED MIDI GENERATION THREAD ---
        const midiWorkerUrl = "/dist/verovio/verovio-worker.js";
        const midiWorker = new Worker(midiWorkerUrl);
        midiWorker.postMessage({
          verovioUrl: "https://www.verovio.org/javascript/latest/verovio-toolkit-wasm.js"
        });
        const midiProxy = new VerovioWorkerProxy(midiWorker) as unknown as IVerovioWorkerProxy;
        await midiProxy.onRuntimeInitialized();
        if (canceled) return;

        // Clone the globally cleansed core document for explicit accidental modulation strictly for MIDI engine overrides natively
        const midiXmlDoc = parser.parseFromString(safeSvgText, 'text/xml');

        // 4. Accidental Modulation Fix (Strictly ordered insertion for MIDI compilation preventing enharmonic flattening skips)
        const midiNotes = midiXmlDoc.getElementsByTagName('note');
        for (let i = 0; i < midiNotes.length; i++) {
          const noteNode = midiNotes[i];
          const pitch = noteNode.getElementsByTagName('pitch')[0];
          const ExistingAccidental = noteNode.getElementsByTagName('accidental');
          if (pitch && ExistingAccidental.length === 0) {
            const alter = pitch.getElementsByTagName('alter')[0];
            let accType = 'natural';
            if (alter) {
              const val = alter.textContent;
              if (val === '-1') accType = 'flat';
              else if (val === '1') accType = 'sharp';
              else if (val === '-2') accType = 'flat-flat';
              else if (val === '2') accType = 'double-sharp';
            }
            const accNode = midiXmlDoc.createElement('accidental');
            accNode.textContent = accType;

            const timeMod = noteNode.getElementsByTagName('time-modification')[0];
            const stem = noteNode.getElementsByTagName('stem')[0];
            const notehead = noteNode.getElementsByTagName('notehead')[0];
            const noteheadText = noteNode.getElementsByTagName('notehead-text')[0];
            const staves = noteNode.getElementsByTagName('staff')[0];
            const beam = noteNode.getElementsByTagName('beam')[0];
            const notations = noteNode.getElementsByTagName('notations')[0];
            const lyric = noteNode.getElementsByTagName('lyric')[0];
            const play = noteNode.getElementsByTagName('play')[0];

            const anchor = timeMod || stem || notehead || noteheadText || staves || beam || notations || lyric || play || null;
            noteNode.insertBefore(accNode, anchor);
          }
        }

        const safeMidiText = serializer.serializeToString(midiXmlDoc);
        // Inject MIDI instrument program changes for proper instrument sounds
        const enrichedMidiText = injectMidiInstruments(safeMidiText);
        await midiProxy.loadData(enrichedMidiText);

        let midiStr = '';
        if (!canceled) {
          midiStr = await midiProxy.renderToMIDI();
          if (!midiStr || midiStr.trim() === '') {
            console.error("[MusicXML] FATAL: DOMParser compilation generated an illegal XSD layout!");
            await midiProxy.loadData(safeSvgText);
            midiStr = await midiProxy.renderToMIDI();
          }
          if (midiStr) {
            onMidiExtracted?.('data:audio/midi;base64,' + midiStr);
          }
        }
        midiWorker.terminate();

        if (canceled) return;

      } catch (e: any) {
        if (!canceled) {
          setError(e.message ?? "Unknown error loading score");
          setLoading(false); // Only toggle loading off if error natively
        }
      }
    };

    loadScore();
    return () => {
      canceled = true;
    };
  }, [scoreFileId]);

  // --- EFFECT B: LIGHTWEIGHT WEBASSEMBLY VIEWPORT RENDER (RUNS ON SCALE / WIDTH CHANGES) ---
  useEffect(() => {
    if (!processedXml || !workerProxyRef.current || debouncedWidth === 0) return;
    let canceled = false;

    const renderLayout = async () => {
      setLoading(true);
      try {
        const proxy = workerProxyRef.current;
        if (!proxy) return;

        await proxy.setOptions({
          pageHeight: 60000,
          pageWidth: Math.round(debouncedWidth * (100 / scale)),
          pageMarginLeft: 50,
          pageMarginRight: 50,
          pageMarginTop: 50,
          pageMarginBottom: 50,
          scale: scale,
          spacingLinear: 0.25,
          spacingNonLinear: 0.6,
          adjustPageHeight: true,
          breaks: "auto"
        });
        if (canceled) return;

        await proxy.loadData(processedXml);
        if (canceled) return;

        const svg = await proxy.renderToSVG(1);
        if (canceled) return;

        const rawTimemap = await proxy.renderToTimemap();
        if (canceled) return;
        localTimemapRef.current = rawTimemap;

        svgContentRef.current = svg;
        setRenderVersion(v => v + 1);
      } catch (e) {
        console.error("Verovio Render Layout failed:", e);
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    renderLayout();
    return () => {
      canceled = true;
    };
  }, [processedXml, scale, debouncedWidth]);

  // Write SVG string directly to DOM via ref (bypasses React reconciliation)
  // This ensures React never wipes CSS classes we add to SVG elements.
  useEffect(() => {
    if (!svgContainerRef.current || !svgContentRef.current) return;
    svgContainerRef.current.innerHTML = svgContentRef.current;
    // IMPORTANT: 'height: auto' on SVG requires a viewBox to compute proportional height.
    // Without viewBox, browsers default SVG height to 150px regardless of content.
    const topSvg = svgContainerRef.current.querySelector(':scope > svg') as SVGSVGElement | null;
    if (topSvg) {
      let w = parseFloat(topSvg.getAttribute('width') ?? '0');
      let h = parseFloat(topSvg.getAttribute('height') ?? '0');
      // Fallback: derive from definition-scale viewBox if outer SVG lacks height
      if (h <= 0 || isNaN(h)) {
        const defVb = topSvg.querySelector('.definition-scale')?.getAttribute('viewBox');
        if (defVb) {
          const parts = defVb.split(/\s+/).map(Number);
          // outer SVG coords are 1/10 of definition-scale units
          if (parts.length === 4) { w = parts[2] / 10; h = parts[3] / 10; }
        }
      }
      if (w > 0 && h > 0) topSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      topSvg.removeAttribute('width');
      topSvg.removeAttribute('height');
      topSvg.style.display = 'block';
      topSvg.style.width = '100%';
      topSvg.style.height = 'auto';
    }
  }, [renderVersion]);

  // --- Magic Sync: Highlight & Auto-scroll ---
  const activeMeasureRef = useRef<number | string | null>(null);
  const prevIsWaitModeRef = useRef<boolean>(isWaitMode);
  const scrollTargetRef = useRef<Element | null>(null);

  const highlightMeasure = (measureEl: Element | null, shouldScroll: boolean) => {
    const container = svgContainerRef.current;
    if (!container) return;
    container.querySelectorAll(".active-measure").forEach(el => el.classList.remove("active-measure"));

    if (measureEl) {
      if (!isWaitMode) {
        measureEl.classList.add("active-measure");
      }
      if (shouldScroll) {
        const systemEl = measureEl.closest('.system');
        const targetEl = systemEl || measureEl;

        if (targetEl !== scrollTargetRef.current) {
          scrollTargetRef.current = targetEl;

          // Safari's targetEl.scrollIntoView() fails on SVG <g> elements because it internally
          // relies on getBoundingClientRect(), which returns zeros for SVGs with <use> tags in WebKit.
          // FIX: Calculate scroll target natively via getBBox() and getScreenCTM().
          const scrollContainerNode = containerRef.current;
          if (scrollContainerNode && targetEl instanceof SVGGraphicsElement) {
            try {
              const bbox = targetEl.getBBox();
              const ctm = targetEl.getScreenCTM();
              if (ctm) {
                const screenTop = bbox.x * ctm.b + bbox.y * ctm.d + ctm.f;
                const scrollContainerRect = scrollContainerNode.getBoundingClientRect();
                const scrollTop = scrollContainerNode.scrollTop || 0;

                // absoluteY is the distance from the top of the scrollable content
                const absoluteY = (screenTop - scrollContainerRect.top) + scrollTop;

                // Target scroll offset: center the system vertically in the viewport
                // We subtract a little extra to account for empty margins or fixed headers
                const targetScrollTop = absoluteY - (scrollContainerNode.clientHeight / 2) + (bbox.height * ctm.d / 2);

                scrollContainerNode.scrollTo({
                  top: targetScrollTop,
                  behavior: 'smooth'
                });
                return;
              }
            } catch (e) {
              console.warn("Manual SVG scrolling failed", e);
            }
          }

          // Fallback for browsers where getBBox might fail or targetEl is HTML
          targetEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
      }
    }
  };

  useEffect(() => {
    if (renderVersion === 0) return;
    activeMeasureRef.current = null;
    scrollTargetRef.current = null;
    measuresCacheRef.current = svgContainerRef.current?.querySelectorAll('.definition-scale .measure') || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderVersion, timemap]);

  // Playback position -> active measure highlight & SMOOTH PLAYHEAD
  // Uses a RAF loop instead of useEffect[positionMs] to avoid main-thread blocking
  // from expensive SVG layout queries (getBBox, getScreenCTM, getBoundingClientRect)
  const playheadRafRef = useRef<number>(0);
  const lastPlayheadMsRef = useRef(-1);

  useEffect(() => {
    if (!timemap || timemap.length === 0 || renderVersion === 0) {
      return;
    }

    const updatePlayhead = () => {
      const currentPosMs = positionMsRef.current;
      lastPlayheadMsRef.current = currentPosMs;

      const container = svgContainerRef.current;
      const playhead = playheadRef.current;
      const rawTimemap = localTimemapRef.current;

      if (!container || !playhead || !measuresCacheRef.current) {
        console.warn("Playhead loop missing refs:", { container: !!container, playhead: !!playhead, measures: !!measuresCacheRef.current });
        return;
      }

      // --- RESOLVE ALGEBRAIC TIMEMAP (Handles repeats and unrolls time natively) ---
      let currentEvent: typeof timemap[0] | null = null;
      let nextEvent: typeof timemap[0] | null = null;

      for (let i = 0; i < timemap.length; i++) {
        if (currentPosMs >= timemap[i].timeMs) {
          currentEvent = timemap[i];
        } else {
          nextEvent = timemap[i];
          break;
        }
      }

      let progress = 0;
      if (currentEvent) {
        if (nextEvent) {
          const duration = nextEvent.timeMs - currentEvent.timeMs;
          if (duration > 0) {
            // Use beatTimestamps for sub-measure interpolation when available
            const beats = currentEvent.beatTimestamps;
            if (beats && beats.length > 1) {
              // Find current beat segment
              let beatIdx = 0;
              for (let b = beats.length - 1; b >= 0; b--) {
                if (currentPosMs >= beats[b]) { beatIdx = b; break; }
              }
              const beatStart = beats[beatIdx];
              const beatEnd = beats[beatIdx + 1] ?? nextEvent.timeMs;
              const beatFraction = beatEnd > beatStart ? (currentPosMs - beatStart) / (beatEnd - beatStart) : 0;
              // Map beat position to non-linear spatial progress exactly across the measure width
              const totalBeats = beats.length;
              // Provide geometric fallback if missing nextEvent bounds: Assume equal spatial distribution
              const segmentStart = beatIdx / totalBeats;
              const segmentEnd = (beatIdx + 1) / totalBeats;
              progress = Math.max(0, Math.min(1, segmentStart + (segmentEnd - segmentStart) * beatFraction));
            } else {
              progress = Math.max(0, Math.min(1, (currentPosMs - currentEvent.timeMs) / duration));
            }
          }
        } else {
          // Last measure: estimate duration from durationInQuarters or fallback
          const lastTempo = currentEvent.tempo || 120;
          const lastDurationQ = currentEvent.durationInQuarters || 3;
          const estimatedDurationMs = lastDurationQ * (60000 / lastTempo);
          if (estimatedDurationMs > 0) {
            progress = Math.max(0, Math.min(1, (currentPosMs - currentEvent.timeMs) / estimatedDurationMs));
          }
        }
      }

      if (rawTimemap && rawTimemap.length > 0 && timemapSource !== "manual") {
        const targetBPM = payloadTempo || 120;
        let vrvBaseTempo = targetBPM;
        for (const entry of rawTimemap) {
          if (entry.tempo) {
            vrvBaseTempo = entry.tempo;
            break;
          }
        }
        
        // Translates real audio time strictly into Verovio theoretical time.
        // Extremely critical for Manual Timemaps: manual timemaps dynamically warp `timeMs` 
        // causing it to diverge drastically from the theoretical unrolled tstamp grid of Verovio natively.
        let currentVrvMs = 0;
        if (currentEvent) {
           const currentPhysicalId = getPhysicalMeasure(currentEvent.measure, measureMap);
           const firstOccurrence = timemap.find(t => getPhysicalMeasure(t.measure, measureMap) === currentPhysicalId);
           
           if (firstOccurrence) {
              let theoreticalMs = 0;
              for (let i = 0; i < timemap.length; i++) {
                 const ev = timemap[i];
                 if (ev === firstOccurrence) break;
                 const bpm = ev.tempo || vrvBaseTempo;
                 theoreticalMs += (ev.durationInQuarters || 4) * (60000 / bpm);
              }
              
              const currentBpm = firstOccurrence.tempo || vrvBaseTempo;
              const currentDurationMs = (firstOccurrence.durationInQuarters || 4) * (60000 / currentBpm);
              
              // Project relativistic `progress` onto strict theoretical geometry.
              // Since `theoreticalMs` is computed exactly matching Verovio's tempo scale, 
              // no further multiplication is required.
              currentVrvMs = theoreticalMs + (progress * currentDurationMs);
           }
        }
        
        let activeIdx = 0;
        for (let i = 0; i < rawTimemap.length; i++) {
          if (currentVrvMs >= rawTimemap[i].tstamp) {
            activeIdx = i;
          } else {
            break;
          }
        }
        
        // Find the most recent event that actually turns notes ON so we don't null-bailout on "off" ticks
        let validActiveIdx = activeIdx;
        while (validActiveIdx > 0 && (!rawTimemap[validActiveIdx]?.on || rawTimemap[validActiveIdx]?.on?.length === 0)) {
           validActiveIdx--;
        }
        
        // Find the next upcoming event that turns notes ON
        let validNextIdx = activeIdx + 1;
        while (validNextIdx < rawTimemap.length && (!rawTimemap[validNextIdx]?.on || rawTimemap[validNextIdx]?.on?.length === 0)) {
           validNextIdx++;
        }

        const currentEntry = rawTimemap[validActiveIdx];
        const nextEntry = validNextIdx < rawTimemap.length ? rawTimemap[validNextIdx] : undefined;
        
        let outMeasure = { el: null as SVGGElement | null };
        const getLeftX = (entry: VerovioTimemapEntry, out?: { el: SVGGElement | null }): number | null => {
          if (!entry || !entry.on || entry.on.length === 0) return null;
          let minLeft = Infinity;
          for (const id of entry.on) {
            const el = document.getElementById(id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.left < minLeft) {
                 minLeft = rect.left;
                 if (out && !out.el) out.el = el.closest('.measure') as SVGGElement;
              }
            }
          }
          return minLeft !== Infinity ? minLeft : null;
        };

        // CACHE LAYOUT QUERIES TO PREVENT 60FPS THRASHING
        if ((playhead as any)._lastActiveIdx !== validActiveIdx || (playhead as any)._renderVersion !== renderVersion) {
          (playhead as any)._lastActiveIdx = validActiveIdx;
          (playhead as any)._renderVersion = renderVersion;
          (playhead as any)._currentX = getLeftX(currentEntry, outMeasure);
          (playhead as any)._measureEl = outMeasure.el;
          (playhead as any)._nextX = nextEntry ? getLeftX(nextEntry) : null;
          
          if (outMeasure.el && containerRef.current) {
             const measureEl = outMeasure.el;
             const scrollContainerNode = containerRef.current;
             const scrollContainerRect = scrollContainerNode.getBoundingClientRect();
             const scrollLeft = scrollContainerNode.scrollLeft || 0;
             const scrollTop = scrollContainerNode.scrollTop || 0;
             const bbox = (measureEl as any)._bboxCache || ((measureEl as any)._bboxCache = measureEl.getBBox());
             const ctm = measureEl.getScreenCTM();
             if (ctm) {
                 const screenLeft = bbox.x * ctm.a + bbox.y * ctm.c + ctm.e;
                 const screenTop = bbox.x * ctm.b + bbox.y * ctm.d + ctm.f;
                 const screenHeight = bbox.height * ctm.d;
                 const absoluteY = (screenTop - scrollContainerRect.top) + scrollTop;
                 const targetXBase = -scrollContainerRect.left + scrollLeft;
                 const measureRightX = (screenLeft + bbox.width * ctm.a - scrollContainerRect.left) + scrollLeft;
                 (playhead as any)._vrvLayout = { screenHeight, absoluteY, targetXBase, measureRightX };
             }
          }
        } else {
          outMeasure.el = (playhead as any)._measureEl;
        }

        const currentX = (playhead as any)._currentX;
        const measureEl = outMeasure.el;

        if (currentX !== null && measureEl) {
          // Highlight the measure directly via its DOM element natively
          // ONLY handle scrolling in Verovio if Wait Mode is on!
          // Normal mode hands over the wheel to the Algebraic block to prevent infinite scrolling loops.
          if (isWaitMode) {
             if (measureEl.id !== activeMeasureRef.current || prevIsWaitModeRef.current !== isWaitMode) {
                activeMeasureRef.current = measureEl.id;
                prevIsWaitModeRef.current = isWaitMode;
                highlightMeasure(measureEl, isPlaying);
             }
          }

          // Handle per-note exact highlighting (MuseScore style)
          if (isPlaying && currentEntry.on && currentEntry.on.length > 0) {
             // 1. Clear previous notes
             for (const el of activeNoteElementsRef.current) {
                el.classList.remove('active-verovio-note');
             }
             activeNoteElementsRef.current = [];
             
             // 2. Add class to current playing notes
             for (const id of currentEntry.on) {
                const el = document.getElementById(id);
                if (el) {
                   el.classList.add('active-verovio-note');
                   activeNoteElementsRef.current.push(el as any);
                }
             }
          } else if (!isPlaying) {
             // Clear all if paused
             for (const el of activeNoteElementsRef.current) {
                el.classList.remove('active-verovio-note');
             }
             activeNoteElementsRef.current = [];
          }

          // Compute absolute container coordinates
          const scrollContainerNode = containerRef.current;
          if (scrollContainerNode) {
             const scrollContainerRect = scrollContainerNode.getBoundingClientRect();
             const scrollLeft = scrollContainerNode.scrollLeft || 0;
             const scrollTop = scrollContainerNode.scrollTop || 0;

             let targetX = (currentX - scrollContainerRect.left) + scrollLeft;

             // Compute Vertical bounds natively from the measure SVG
             const bbox = (measureEl as any)._bboxCache || ((measureEl as any)._bboxCache = measureEl.getBBox());
             const ctm = measureEl.getScreenCTM();
             if (ctm) {
                const screenTop = bbox.x * ctm.b + bbox.y * ctm.d + ctm.f;
                // Add a small styling injection to color active notes dynamically
                const screenHeight = bbox.height * ctm.d;
                const absoluteY = (screenTop - scrollContainerRect.top) + scrollTop;

                // Mode 1: Wait Mode -> Geometric Per-Note Playhead
                if (isWaitMode) {
                   const screenLeft = bbox.x * ctm.a + bbox.y * ctm.c + ctm.e;
                   const screenWidth = bbox.width * ctm.a;
                   const measureRightX = (screenLeft + screenWidth - scrollContainerRect.left) + scrollLeft;

                   if (nextEntry) {
                      const nextX = (playhead as any)._nextX;
                      const duration = nextEntry.tstamp - currentEntry.tstamp;
                      if (nextX !== null && duration > 0) {
                         let targetNextX = (nextX - scrollContainerRect.left) + scrollLeft;
                         if (targetNextX > targetX) {
                            const fraction = (currentVrvMs - currentEntry.tstamp) / duration;
                            targetX = targetX + (targetNextX - targetX) * fraction;
                         } else {
                            const fraction = (currentVrvMs - currentEntry.tstamp) / duration;
                            let lerpRightX = measureRightX;
                            if (lerpRightX < targetX) lerpRightX = targetX;
                            targetX = targetX + (lerpRightX - targetX) * fraction;
                         }
                      }
                   }

                   playhead.style.transform = `translate(${targetX}px, ${absoluteY}px)`;
                   playhead.style.height = `${screenHeight}px`;
                   playhead.style.opacity = '1';
                   
                   if (isPlaying) {
                     playheadRafRef.current = requestAnimationFrame(updatePlayhead);
                   }
                   return; // Ends here. We use exact note-positions for playhead!
                }
                
                // Mode 2: Normal Mode -> Fall through to Algebraic for Smooth Beat Interpolation
             }
          }
        } else {
           if (isPlaying && Math.random() < 0.05) {
             console.log("Verovio Tracking bailout! currentVrvMs:", currentVrvMs, "currentX:", currentX, "measureEl:", measureEl?.id, "currentEntry ids:", currentEntry?.on?.join(","));
           }
        }
      }

      // --- FALLBACK TO ALGEBRAIC TIMEMAP (If Verovio renderToTimemap hasn't finished loading yet) ---

      if (currentEvent && container && playhead && measuresCacheRef.current) {

        const physicalIndex = getPhysicalMeasure(currentEvent.measure, measureMap);
        const measureEl = measuresCacheRef.current[physicalIndex - 1] as SVGGElement | undefined;

        if (measureEl) {
          if (currentEvent.measure !== activeMeasureRef.current || prevIsWaitModeRef.current !== isWaitMode) {
            activeMeasureRef.current = currentEvent.measure;
            prevIsWaitModeRef.current = isWaitMode;
            highlightMeasure(measureEl, isPlaying);
          }

          // CACHE LAYOUT QUERIES FOR ALGEBRAIC MODE
          if ((playhead as any)._lastAlgMeasure !== currentEvent.measure || (playhead as any)._renderVersion !== renderVersion) {
            (playhead as any)._lastAlgMeasure = currentEvent.measure;
            (playhead as any)._renderVersion = renderVersion;
            
            const bbox = (measureEl as any)._bboxCache || ((measureEl as any)._bboxCache = measureEl.getBBox());
            const ctm = measureEl.getScreenCTM();
            if (ctm && containerRef.current) {
               const scrollContainerNode = containerRef.current;
               const scrollContainerRect = scrollContainerNode.getBoundingClientRect();
               const scrollLeft = scrollContainerNode.scrollLeft || 0;
               const scrollTop = scrollContainerNode.scrollTop || 0;
               
               const screenLeft = bbox.x * ctm.a + bbox.y * ctm.c + ctm.e;
               const screenTop = bbox.x * ctm.b + bbox.y * ctm.d + ctm.f;
               const screenWidth = bbox.width * ctm.a;
               const screenHeight = bbox.height * ctm.d;
               
               const startX = (screenLeft - scrollContainerRect.left) + scrollLeft;
               const absoluteY = (screenTop - scrollContainerRect.top) + scrollTop;
               
               let trueWidth = screenWidth;
               if (nextEvent) {
                  const nextPhysicalIndex = getPhysicalMeasure(nextEvent.measure, measureMap);
                  const nextMeasureEl = measuresCacheRef.current[nextPhysicalIndex - 1] as SVGGElement | undefined;
                  if (nextMeasureEl) {
                     const nextBbox = (nextMeasureEl as any)._bboxCache || ((nextMeasureEl as any)._bboxCache = nextMeasureEl.getBBox());
                     const nextCtm = nextMeasureEl.getScreenCTM();
                     if (nextCtm) {
                        const nextScreenLeft = nextBbox.x * nextCtm.a + nextBbox.y * nextCtm.c + nextCtm.e;
                        const nextScreenTop = nextBbox.x * nextCtm.b + nextBbox.y * nextCtm.d + nextCtm.f;
                        if (Math.abs(nextScreenTop - screenTop) < 50 && nextScreenLeft > screenLeft) {
                           trueWidth = nextScreenLeft - screenLeft;
                        }
                     }
                  }
               }
               
               (playhead as any)._algLayout = { startX, absoluteY, trueWidth, screenHeight };
            }
          }
          
          const algLayout = (playhead as any)._algLayout;
          if (algLayout) {
             const playheadX = algLayout.startX + (algLayout.trueWidth * progress);
             const playheadY = algLayout.absoluteY;

             if (isWaitMode) {
               playhead.style.opacity = '0';
             } else {
               playhead.style.transform = `translate(${playheadX}px, ${playheadY}px)`;
               playhead.style.height = `${algLayout.screenHeight}px`;
               playhead.style.opacity = '1';
             }
          }
        } else {
          playhead.style.opacity = '0';
        }
      } else {
        if (playheadRef.current) playheadRef.current.style.opacity = '0';
        highlightMeasure(null, false);
        activeMeasureRef.current = null;
      }

      if (isPlaying) {
        playheadRafRef.current = requestAnimationFrame(updatePlayhead);
      }
    };

    if (isPlaying) {
      lastPlayheadMsRef.current = -1; // Force first update
      playheadRafRef.current = requestAnimationFrame(updatePlayhead);
    } else {
      // One-shot update when not playing (for seek/stop position)
      lastPlayheadMsRef.current = -1;
      updatePlayhead();
    }

    return () => {
      if (playheadRafRef.current) cancelAnimationFrame(playheadRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, timemap, measureMap, renderVersion, isWaitMode]);

  // Dedicated stop-reset: when playback stops and position is 0, force playhead/highlight to measure 1
  useEffect(() => {
    const isActuallyAtStart = positionMsRef.current === 0;
    if (!isPlaying && isActuallyAtStart && measuresCacheRef.current && timemap.length > 0) {
      // Clear any existing highlight
      svgContainerRef.current?.querySelectorAll('.active-measure').forEach(el => el.classList.remove('active-measure'));
      // Highlight first measure
      const firstMeasure = timemap[0];
      const physicalIndex = getPhysicalMeasure(firstMeasure.measure, measureMap);
      const measureEl = measuresCacheRef.current[physicalIndex - 1] as SVGGElement | undefined;
      if (measureEl && !isWaitMode) {
        measureEl.classList.add('active-measure');
      }
      // Reset playhead to first measure position
      if (playheadRef.current && measureEl) {
        const bbox = measureEl.getBBox();
        const ctm = measureEl.getScreenCTM();
        if (ctm) {
          const scrollContainerNode = containerRef.current;
          if (scrollContainerNode) {
            const scrollContainerRect = scrollContainerNode.getBoundingClientRect();
            const scrollLeft = scrollContainerNode.scrollLeft || 0;
            const scrollTop = scrollContainerNode.scrollTop || 0;
            const screenLeft = bbox.x * ctm.a + bbox.y * ctm.c + ctm.e;
            const screenTop = bbox.x * ctm.b + bbox.y * ctm.d + ctm.f;
            const startX = (screenLeft - scrollContainerRect.left) + scrollLeft;
            const absoluteY = (screenTop - scrollContainerRect.top) + scrollTop;
            const screenHeight = bbox.height * ctm.d;
            playheadRef.current.style.transform = `translate(${startX}px, ${absoluteY}px)`;
            playheadRef.current.style.height = `${screenHeight}px`;
            playheadRef.current.style.opacity = '1';
            // Scroll back to top
            scrollContainerNode.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      }
      activeMeasureRef.current = firstMeasure.measure;
      lastPlayheadMsRef.current = -1;
    }
  }, [isPlaying, positionMs, timemap, measureMap, isWaitMode]);

  // Handle clicking on measures to seek
  const handleSvgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isWaitMode) return; // Mute seeking controls while playing Flashcards
    if (!onSeek || !timemap || timemap.length === 0) return;

    // Find closest .measure group
    const target = e.target as Element;
    const measureEl = target.closest('.measure');
    if (!measureEl) return;

    const container = svgContainerRef.current;
    if (!container) return;
    const allMeasures = Array.from(container.querySelectorAll('.definition-scale .measure'));
    const index = allMeasures.indexOf(measureEl as Element);
    if (index === -1) return;

    const clickedPhysicalMeasure = index + 1;
    const candidateLatents: number[] = [];
    for (const entry of timemap) {
      if (getPhysicalMeasure(entry.measure, measureMap) === clickedPhysicalMeasure) {
        candidateLatents.push(entry.measure);
      }
    }

    if (candidateLatents.length === 0) return;

    let bestLatent = candidateLatents[0];
    let bestDistance = Infinity;
    for (const lat of candidateLatents) {
      const mapEntry = timemap.find(t => t.measure === lat);
      if (mapEntry) {
        const dist = Math.abs(mapEntry.timeMs - positionMs);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestLatent = lat;
        }
      }
    }

    const finalMapEntry = timemap.find(t => t.measure === bestLatent);
    if (finalMapEntry) {
      if (onSeek) onSeek(finalMapEntry.timeMs);
      highlightMeasure(measureEl, false);
      activeMeasureRef.current = bestLatent;
    }
  };

  // --- WAIT MODE V2 Core Progression Logic ---

  // Dynamic Viewport Forward Tracker (Resolves implicit missing Measure Strings natively)
  const executeDOMForwardEdgeScroll = useCallback((container: Element) => {
    // CRITICAL GUARD: Only execute DOM edge-tracking logic if we are formally within Wait Mode.
    // In Normal Mode, the mathematical timeline interpolation engine guarantees perfect highlight/scroll sync natively.
    const isActuallyWaitMode = document.getElementById("musicxml-container")?.classList.contains("wait-mode-active");
    if (!isActuallyWaitMode) return;

    const activeNodes = container.querySelectorAll(".wait-mode-missed, .note-playing-correct");
    if (activeNodes.length === 0) return;

    const forwardMostNode = activeNodes[activeNodes.length - 1];
    const maxMeasureNode = forwardMostNode.closest('.measure');

    if (maxMeasureNode) {
      const measureEl = maxMeasureNode as Element;

      const sys = measureEl.closest('.system');
      const finalTarget = sys || measureEl;

      if (finalTarget !== scrollTargetRef.current) {
        scrollTargetRef.current = finalTarget;
        const scrollBox = containerRef.current;

        if (scrollBox && measureEl instanceof SVGGraphicsElement) {
          try {
            const svgEl = measureEl as SVGGraphicsElement;
            const bbox = svgEl.getBBox();
            const ctm = svgEl.getScreenCTM();
            if (ctm) {
              const screenTop = bbox.x * ctm.b + bbox.y * ctm.d + ctm.f;
              const scrollContainerRect = scrollBox.getBoundingClientRect();
              const scrollTop = scrollBox.scrollTop || 0;
              const absoluteY = (screenTop - scrollContainerRect.top) + scrollTop;

              const targetScrollTop = absoluteY - (scrollBox.clientHeight / 2) + (bbox.height * ctm.d / 2);
              scrollBox.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
            }
          } catch (e) { }
        }
      }
    }
  }, []);

  const lastActiveQueryMsRef = useRef<number>(0);
  const isQueryingActiveNotesRef = useRef(false);

  // Helper to map unrolled playback time back to the first physical pass for Verovio
  const mapToPhysicalTime = useCallback((unrolledMs: number) => {
    if (!timemap || timemap.length === 0 || !measureMap) return unrolledMs;
    let currentEvent = timemap[0];
    for (let i = 0; i < timemap.length; i++) {
      if (unrolledMs >= timemap[i].timeMs) {
        currentEvent = timemap[i];
      } else {
        break;
      }
    }
    const physicalMeasure = getPhysicalMeasure(currentEvent.measure, measureMap);
    const originalEvent = timemap.find(t => getPhysicalMeasure(t.measure, measureMap) === physicalMeasure);
    
    if (originalEvent && originalEvent.timeMs < currentEvent.timeMs) {
      const offset = unrolledMs - currentEvent.timeMs;
      return originalEvent.timeMs + offset;
    }
    
    return unrolledMs;
  }, [timemap, measureMap]);

  // Active Playback Highlighting (Blue) + Inverse Sieve Extraction
  useEffect(() => {
    if (isPlaying || (isWaitMode && !isWaiting)) {
      const currentPosMs = positionMsRef.current;
      if (Math.abs(currentPosMs - lastActiveQueryMsRef.current) > 50 && !isQueryingActiveNotesRef.current && workerProxyRef.current) {
        lastActiveQueryMsRef.current = currentPosMs;
        isQueryingActiveNotesRef.current = true;

        const qPos = Math.round(mapToPhysicalTime(currentPosMs));
        workerProxyRef.current.getElementsAtTime(qPos).then((data: any) => {
          isQueryingActiveNotesRef.current = false;
          const container = svgContainerRef.current;
          if (!container) return;

          container.querySelectorAll(".note-playing-correct").forEach(el => el.classList.remove("note-playing-correct"));
          const notes = data?.notes || [];

          if (Array.isArray(notes) && notes.length > 0) {
            let targetX = -1;
            // Iterate BACKWARDS to cleanly slice the front-most chronological chord while completely ignoring all historical pedal notes natively!
            for (let i = notes.length - 1; i >= 0; i--) {
              const el = container.querySelector("#" + notes[i]) as SVGGraphicsElement | null;
              if (!el || el.classList.contains("wait-mode-missed")) continue;

              const staffNode = el.closest('.staff');
              if (staffNode && practiceTrackIds && practiceTrackIds.length > 0 && !practiceTrackIds.includes(-1)) {
                let staffN = 1;
                const measureNode = staffNode.closest('.measure');
                if (measureNode) {
                  const staves = Array.from(measureNode.querySelectorAll('.staff'));
                  staffN = staves.indexOf(staffNode as Element) + 1;
                } else {
                  staffN = parseInt(staffNode.getAttribute('n') || "1", 10);
                }

                if (!practiceTrackIds.includes(staffN - 1)) continue;
              }

              try {
                const bbox = el.getBBox();
                if (targetX === -1) {
                  targetX = bbox.x;
                } else if (targetX - bbox.x > 35 || bbox.x - targetX > 150) {
                  break; // INSTANT ABORT.
                }
              } catch (e) { }

              el.classList.add("note-playing-correct");
            }
            executeDOMForwardEdgeScroll(container);
          }
        }).catch(() => { isQueryingActiveNotesRef.current = false; });
      }
    } else if (!isPlaying && !isWaitMode && svgContainerRef.current) {
      svgContainerRef.current.querySelectorAll(".note-playing-correct").forEach(el => el.classList.remove("note-playing-correct"));
    }
    // positionMs intentionally read from ref, not deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, isWaitMode, isWaiting]);

  // Wait Mode Precedential Targeting Highlighting (Red) + Inverse Sieve Extraction
  useEffect(() => {
    if (isWaitMode && isWaiting && workerProxyRef.current && svgContainerRef.current) {
      const container = svgContainerRef.current;
      const qPos = Math.round(mapToPhysicalTime(positionMsRef.current));

      workerProxyRef.current.getElementsAtTime(qPos + 5).then((data: any) => {
        const notes = data?.notes || [];
        container.querySelectorAll(".wait-mode-missed").forEach(el => el.classList.remove("wait-mode-missed"));

        // CRITICAL FIX: Purge stale transit-window Blue classes! Overrides Red targets natively through CSS specificity cascades.
        container.querySelectorAll(".note-playing-correct").forEach(el => el.classList.remove("note-playing-correct"));

        let minLeft = Infinity;
        const scrollBox = containerRef.current;
        if (!scrollBox) return;

        const cRect = scrollBox.getBoundingClientRect();
        const sLeft = scrollBox.scrollLeft || 0;

        if (Array.isArray(notes) && notes.length > 0) {
          let targetX = -1;
          for (let i = notes.length - 1; i >= 0; i--) {
            const el = container.querySelector("#" + notes[i]) as SVGGraphicsElement | null;
            if (!el) continue;

            const staffNode = el.closest('.staff');
            if (staffNode && practiceTrackIds && practiceTrackIds.length > 0 && !practiceTrackIds.includes(-1)) {
              let staffN = 1;
              const measureNode = staffNode.closest('.measure');
              if (measureNode) {
                const staves = Array.from(measureNode.querySelectorAll('.staff'));
                staffN = staves.indexOf(staffNode as Element) + 1;
              } else {
                staffN = parseInt(staffNode.getAttribute('n') || "1", 10);
              }

              if (!practiceTrackIds.includes(staffN - 1)) continue;
            }

            try {
              const bbox = el.getBBox();
              if (targetX === -1) {
                targetX = bbox.x;
              } else if (targetX - bbox.x > 35 || bbox.x - targetX > 150) {
                break; // Halt execution. Only target the exact unified visual chord sequence.
              }

              el.classList.add("wait-mode-missed");

              const ctm = el.getScreenCTM();
              if (ctm && el.classList.contains('note')) {
                const sX = bbox.x * ctm.a + bbox.y * ctm.c + ctm.e;
                const absX = (sX - cRect.left) + sLeft;
                if (absX < minLeft) minLeft = absX;
              }
            } catch (e) { }
          }

          if (minLeft !== Infinity && playheadRef.current) {
            const currentT = playheadRef.current.style.transform;
            const yMatch = currentT ? currentT.match(/translate\([^,]+px,\s*([^)]+)px\)/) : null;
            const curY = yMatch ? parseFloat(yMatch[1]) : 0;
            playheadRef.current.style.transform = `translate(${minLeft - 4}px, ${curY}px)`;
          }
          executeDOMForwardEdgeScroll(container);
        }

        if (!document.getElementById('wait-mode-styles')) {
          const style = document.createElement('style');
          style.id = 'wait-mode-styles';
          style.innerHTML = `
             .wait-mode-missed, .wait-mode-missed path { fill: #ef4444 !important; stroke: #ef4444 !important; transition: fill 0.2s, stroke 0.2s; }
             .note-playing-correct, .note-playing-correct path { fill: #3b82f6 !important; stroke: #3b82f6 !important; transition: fill 0.1s, stroke 0.1s; }
             .wait-mode-active .measure { cursor: default !important; }
             .wait-mode-active .measure:hover { fill: transparent !important; background: transparent !important; outline: none !important; box-shadow: none !important; pointer-events: none !important; }
           `;
          document.head.appendChild(style);
        }
      }).catch(console.error);
    } else if (svgContainerRef.current) {
      svgContainerRef.current.querySelectorAll(".wait-mode-missed").forEach(el => el.classList.remove("wait-mode-missed"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWaitMode, isWaiting, positionMs, renderVersion, practiceTrackIds]);

  const hasSvg = svgContentRef.current !== null;

  return (
    <div className={cn("flex flex-col h-full bg-white text-black relative", isDarkMode ? "dark-theme bg-zinc-950" : "", className)}>
      {error && (
        <div className="absolute top-2 left-2 text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}
      {loading && (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center z-[110] backdrop-blur-sm transition-colors",
          isDarkMode ? "bg-black/60 text-zinc-300" : "bg-white/60 text-zinc-600"
        )}>
          <div className="flex flex-col items-center gap-4">
            <div className={cn(
              "w-8 h-8 rounded-full border-4 animate-spin",
              isDarkMode ? "border-zinc-800 border-t-[#C8A856]" : "border-zinc-200 border-t-blue-500"
            )}></div>
            <span className="text-sm font-medium tracking-wide">Loading MusicXML...</span>
          </div>
        </div>
      )}


      {/* CSS for Magic Sync Highlights - placed in head, won't be recreated */}
      <style>{`
        #musicxml-svghost > svg {
          display: block;
          width: 100%;
          height: auto !important;
        }
        /* Active Measure is now only used as a scrolling marker, no color */
        /* Click-to-seek hover */
        #musicxml-svghost .measure { cursor: pointer; }
        #musicxml-svghost .measure:hover *,
        #musicxml-svghost .measure:hover use,
        #musicxml-svghost .measure:hover path {
          fill: #f97316 !important;
          stroke: #f97316 !important;
          transition: fill 0.1s, stroke 0.1s;
        }
        /* Dark Mode SVG Inversion */
        .dark-theme #musicxml-container { background: #000000 !important; }
        .dark-theme #musicxml-svghost {
          background: #ffffff !important; /* Must be white BEFORE inversion */
          filter: invert(0.93) hue-rotate(180deg) brightness(1.5) contrast(1.2);
          box-shadow: none !important;
        }
        /* (Active Measure CSS for dark mode is removed since we only highlight individual notes) */
        .dark-theme #musicxml-svghost .measure:hover *,
        .dark-theme #musicxml-svghost .measure:hover use,
        .dark-theme #musicxml-svghost .measure:hover path {
          fill: #c2410c !important;
          stroke: #c2410c !important;
        }
      `}</style>

      {/* Container for SVG — rendered imperatively via ref to avoid React wiping DOM mutations */}
      <div
        ref={containerRef}
        className={cn("flex-1 overflow-auto w-full relative transition-colors scroll-smooth pb-32", isDarkMode ? "bg-[#181a1f]" : "bg-[#fdfdfc]", isWaitMode && "wait-mode-active")}
        id="musicxml-container"
      >
        {/* Absolute Floating Playhead Overlay */}
        <div
          ref={playheadRef}
          className={cn(
            "absolute top-0 left-0 w-1 rounded-full shadow-lg opacity-0 transition-opacity duration-150 pointer-events-none z-10",
            isDarkMode ? "bg-[#C8A856] shadow-[#C8A856]/40" : "bg-blue-600 shadow-blue-600/40"
          )}
          style={{ willChange: 'transform, height' }}
        />

        {/* Main SVG Render Target */}
        <div
          id="musicxml-svghost"
          ref={svgContainerRef}
          className="w-full origin-top-left transition-transform duration-300"
          onClick={handleSvgClick}
        />

        {!hasSvg && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className={cn(
              "w-full max-w-2xl h-64 border-2 border-dashed flex flex-col items-center justify-center rounded-lg shadow-sm transition-colors",
              isDarkMode
                ? "border-zinc-700 bg-[#1a1a1f] text-zinc-400 shadow-none"
                : "border-gray-300 bg-white text-gray-400 object-cover"
            )}>
              <span className={cn("text-lg font-medium mb-2", isDarkMode ? "text-zinc-300" : "text-zinc-600")}>No Sheet Music Loaded</span>
              <span className="text-sm">Please upload a MusicXML or Score file to view the sheet music.</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Zoom Controls */}
      <div className="absolute top-14 right-4 flex gap-1 z-[90] opacity-30 hover:opacity-100 transition-opacity">
        <button
          onClick={() => setScale(s => Math.max(s - 10, 20))}
          className="w-8 h-8 bg-white/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 rounded flex items-center justify-center shadow-sm hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-200 dark:border-zinc-700 backdrop-blur-sm"
          title="Thu nhỏ (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale(s => Math.min(s + 10, 120))}
          className="w-8 h-8 bg-white/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 rounded flex items-center justify-center shadow-sm hover:bg-white dark:hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-200 dark:border-zinc-700 backdrop-blur-sm"
          title="Phóng to (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Verovio Note Highlight Class */}
      <style dangerouslySetInnerHTML={{ __html: `
        .active-verovio-note {
          fill: #f97316 !important;
          stroke: #f97316 !important;
          color: #f97316 !important;
          transition: fill 0.05s ease-out, stroke 0.05s ease-out;
        }
        .active-verovio-note * {
          fill: #f97316 !important;
          stroke: #f97316 !important;
          color: #f97316 !important;
        }
      ` }} />
    </div>
  );
}
