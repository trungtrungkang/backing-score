"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface VirtualKeyboardProps {
  startMidi?: number; // default 21 (A0)
  endMidi?: number;   // default 108 (C8)
  activeNotes?: Set<number>;
  targetNotes?: Set<number>;
  className?: string; // Class for outer scroll container
}

const isWhite = (midi: number) => {
  const noteClass = midi % 12;
  return [0, 2, 4, 5, 7, 9, 11].includes(noteClass);
};

// Check if a white key has a black key exactly to its right
const hasBlackKeyOnRight = (midi: number) => {
  if (!isWhite(midi)) return false;
  return !isWhite(midi + 1);
};

const getNoteName = (midi: number) => {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const note = notes[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
};

export function VirtualKeyboard({
  startMidi = 21,
  endMidi = 108,
  activeNotes = new Set<number>(),
  targetNotes = new Set<number>(),
  className,
}: VirtualKeyboardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the target note when it changes
  useEffect(() => {
    if (targetRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const target = targetRef.current;
      
      const scrollLeft = target.offsetLeft - (container.clientWidth / 2) + (target.clientWidth / 2);
      container.scrollTo({
        left: scrollLeft,
        behavior: "smooth"
      });
    }
  }, [targetNotes]); // re-run if target notes change

  const whiteKeys: number[] = [];
  for (let m = startMidi; m <= endMidi; m++) {
    if (isWhite(m)) whiteKeys.push(m);
  }

  // Pre-calculate optimal width based on viewport, or fixed width for 88 keys
  // 88 keys have 52 white keys
  // Let's make each white key ~24px wide for mobile/desktop legibility
  const idealTotalWidth = whiteKeys.length * 28;

  return (
    <div 
      ref={scrollRef} 
      className={cn(
        "w-full overflow-x-auto overflow-y-hidden border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-inner bg-zinc-900",
        className
      )}
    >
      <div 
        className="flex relative h-full"
        style={{ width: `${Math.max(idealTotalWidth, scrollRef.current?.clientWidth || 0)}px`, minWidth: '100%' }}
      >
        {whiteKeys.map((wMidi) => {
          const bMidi = wMidi + 1;
          const renderBlack = hasBlackKeyOnRight(wMidi) && bMidi <= endMidi;

          const wActive = activeNotes.has(wMidi);
          const wTarget = targetNotes.has(wMidi);
          const bActive = renderBlack && activeNotes.has(bMidi);
          const bTarget = renderBlack && targetNotes.has(bMidi);

          const isC = wMidi % 12 === 0;
          const label = isC ? getNoteName(wMidi) : null;

          return (
            <div
              key={wMidi}
              ref={wTarget ? targetRef : undefined}
              className={cn(
                "relative flex-1 min-w-0 border-r border-zinc-300 dark:border-zinc-700/50 rounded-b-md transition-all duration-75 flex flex-col items-center",
                wTarget ? "bg-sky-100 dark:bg-sky-500/30 border-b-4 border-b-sky-500 shadow-[inset_0_0_20px_rgba(14,165,233,0.3)] animate-pulse" :
                "bg-white dark:bg-zinc-100 hover:bg-zinc-50"
              )}
            >
              {/* Active Note Highlight Dot */}
              {wActive && (
                <div className="absolute bottom-3 w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,1)] z-10" />
              )}
              {/* White Key Bottom Label */}
              {label && (
                <span className="absolute bottom-[2px] w-full text-center text-[8px] sm:text-[9px] font-bold text-zinc-400 select-none">
                  {label}
                </span>
              )}

              {/* Black Key */}
              {renderBlack && (
                <div
                  ref={bTarget ? targetRef : undefined}
                  className={cn(
                    "absolute top-0 right-0 w-[60%] h-[60%] translate-x-[50%] rounded-b transition-all duration-75 flex justify-center",
                    bTarget ? "bg-sky-400 dark:bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.8)] z-30 animate-pulse border-b-2 border-sky-300" :
                    "bg-zinc-900 border border-black z-10",
                    bActive ? "z-30" : ""
                  )}
                >
                  {/* Active Note Highlight Dot */}
                  {bActive && (
                    <div className="absolute bottom-3 w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,1)] z-20" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
