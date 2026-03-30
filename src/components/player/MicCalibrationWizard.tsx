"use client";

import { useState, useEffect, useRef } from "react";
import { MicProfile, useMicInput } from "@/hooks/useMicInput";
import { useMicProfile } from "@/hooks/useMicProfile";
import { VirtualKeyboard } from "./VirtualKeyboard";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Activity, CheckCircle2, AlertTriangle } from "lucide-react";

type Step = "intro" | "noise" | "low_ready" | "low" | "high_ready" | "high" | "saving" | "success";

interface MicCalibrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function MicCalibrationWizard({ isOpen, onClose, onComplete }: MicCalibrationWizardProps) {
  const t = useTranslations("MicCalibrationWizard");
  const [step, setStep] = useState<Step>("intro");
  const [timeRemaining, setTimeRemaining] = useState(5);
  const { saveProfile } = useMicProfile();

  const tempStatsRef = useRef({
    maxSilenceProb: 0,
    maxLowProb: 0,
    maxHighProb: 0,
  });

  const stepRef = useRef<Step>("intro");

  // Keep ref strictly synced with state for the async audio processor
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const { initializeMic, disconnectMic, isMicInitialized, activeNotes: micNotesArray } = useMicInput({
    onFrameAnalyzed: (frame) => {
      // Route the analytics data to the correct statistical bucket based on current step
      const currentStep = stepRef.current;
      if (currentStep === "noise") {
        // Find absolute highest peak during "silence" phase
        let peak = 0;
        for (let i = 0; i < 88; i++) peak = Math.max(peak, frame[i]);
        tempStatsRef.current.maxSilenceProb = Math.max(tempStatsRef.current.maxSilenceProb, peak);
      }
      else if (currentStep === "low") {
        // Measure lowest pitches (MIDI 21 to 48: A0 to C3)
        let peak = 0;
        for (let i = 0; i < 27; i++) peak = Math.max(peak, frame[i]);
        tempStatsRef.current.maxLowProb = Math.max(tempStatsRef.current.maxLowProb, peak);
      }
      else if (currentStep === "high") {
        // Measure highest pitches (MIDI 84 to 108: C6 to C8)
        let peak = 0;
        for (let i = 63; i < 88; i++) peak = Math.max(peak, frame[i]);
        tempStatsRef.current.maxHighProb = Math.max(tempStatsRef.current.maxHighProb, peak);
      }
    }
  });

  useEffect(() => {
    // If dialog closes unexpectedly, kill mic and reset
    if (!isOpen) {
      disconnectMic();
      setStep("intro");
      tempStatsRef.current = { maxSilenceProb: 0, maxLowProb: 0, maxHighProb: 0 };
    }
  }, [isOpen, disconnectMic]);

  // Handle Timed Steps Phase Navigation
  useEffect(() => {
    if (step === "noise" || step === "low" || step === "high") {
      setTimeRemaining(5);
    }
  }, [step]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "noise" || step === "low" || step === "high") {
      timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step]);

  // Phase transition monitor
  useEffect(() => {
    if (timeRemaining === 0) {
      if (step === "noise") setStep("low_ready");
      else if (step === "low") setStep("high_ready");
      else if (step === "high") setStep("saving");
    }
  }, [timeRemaining, step]);

  // Handle Saving Step
  useEffect(() => {
    if (step === "saving") {
      const stats = tempStatsRef.current;
      disconnectMic();

      const noiseFloor = Math.min(0.4, stats.maxSilenceProb); // Cap noise floor

      // Target confidence is 0.35. If user couldn't hit 0.35, calculate negative offset needed.
      // Example: Max low was 0.20. (0.35 - 0.20) = 0.15 offset, but we subtract, so -0.15.
      const lowOffsetOffsetRaw = stats.maxLowProb > 0.05 ? (0.35 - stats.maxLowProb) : 0;
      const highOffsetRaw = stats.maxHighProb > 0.05 ? (0.35 - stats.maxHighProb) : 0;

      // Bound offsets between -0.2 (huge sensitivity boost) to 0 (no boost)
      const newProfile: MicProfile = {
        noiseFloor,
        lowRangeOffset: Math.max(-0.25, Math.min(0, -lowOffsetOffsetRaw)),
        highRangeOffset: Math.max(-0.25, Math.min(0, -highOffsetRaw))
      };

      saveProfile(newProfile).then(() => {
        setStep("success");
      });
    }
  }, [step, disconnectMic, saveProfile]);

  const startTest = async () => {
    const success = await initializeMic();
    if (success) {
      setStep("noise");
    }
  };

  const handleFinish = () => {
    onClose();
    if (onComplete) onComplete();
  };

  // Hide ghost notes from the keyboard UI during Step 1 (noise profiling) so users don't panic
  const activeNotes = step === "noise" ? new Set<number>() : new Set<number>(micNotesArray || []);
  const targetNotes = new Set<number>();
  if (step === "low_ready" || step === "low") {
    targetNotes.add(48); // C3
  } else if (step === "high_ready" || step === "high") {
    targetNotes.add(96); // C7
  }

  const isLowDetected = step === "low" && Array.from(activeNotes).some(n => n <= 48);
  const isHighDetected = step === "high" && Array.from(activeNotes).some(n => n >= 84);

  //console.log("step", step)

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleFinish()}>
        <DialogContent className="sm:max-w-xl bg-zinc-950 border border-zinc-800 shadow-2xl p-0 overflow-hidden flex flex-col z-[100]">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
              <Mic className="text-blue-500 w-5 h-5" />
              {t("title")}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t("desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 px-6 min-h-[220px] flex flex-col items-center justify-center text-center">

            {step === "intro" && (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="text-blue-500 w-8 h-8" />
                </div>
                <p className="text-sm text-zinc-300">
                  {t("introDesc")}
                </p>
                <Button onClick={startTest} className="w-full mt-4 font-bold bg-blue-600 hover:bg-blue-500">
                  {t("startBtn")}
                </Button>
              </div>
            )}

            {step === "noise" && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-red-400">{t("step1Title")}</h3>
                <p className="text-sm text-zinc-400">{t("step1Desc")}</p>
                <div className="text-5xl font-black text-white p-4">{timeRemaining}s</div>
                <Activity className="w-8 h-8 text-zinc-500 animate-pulse mx-auto" />
              </div>
            )}

            {step === "low_ready" && (
              <div className="space-y-4 animate-in slide-in-from-right duration-300">
                <h3 className="text-lg font-bold text-orange-400">{t("step2Title")}</h3>
                <p className="text-sm text-zinc-400">{t("step2Desc")}</p>
                <Button onClick={() => setStep("low")} className="w-full mt-4 font-bold bg-orange-600 hover:bg-orange-500 text-white">
                  {t("readyBtn")}
                </Button>
              </div>
            )}

            {step === "low" && (
              <div className="space-y-4 animate-in zoom-in duration-300">
                <h3 className="text-lg font-bold text-orange-400">{t("recordingBass")}</h3>
                <p className="text-sm font-bold text-white animate-pulse">{t("playLowNotes")}</p>
                <div className="text-5xl font-black text-white p-4">{timeRemaining}s</div>
                <div className="h-8 flex items-center justify-center">
                  {isLowDetected ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full animate-in zoom-in duration-200">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-bold">{t("signalDetected")}</span>
                    </div>
                  ) : (
                    <Activity className="w-8 h-8 text-orange-500 animate-pulse mx-auto" />
                  )}
                </div>
              </div>
            )}

            {step === "high_ready" && (
              <div className="space-y-4 animate-in slide-in-from-right duration-300">
                <h3 className="text-lg font-bold text-sky-400">{t("step3Title")}</h3>
                <p className="text-sm text-zinc-400">{t("step3Desc")}</p>
                <Button onClick={() => setStep("high")} className="w-full mt-4 font-bold bg-sky-600 hover:bg-sky-500 text-white">
                  {t("readyBtn")}
                </Button>
              </div>
            )}

            {step === "high" && (
              <div className="space-y-4 animate-in zoom-in duration-300">
                <h3 className="text-lg font-bold text-sky-400">{t("recordingTreble")}</h3>
                <p className="text-sm font-bold text-white animate-pulse">{t("playHighNotes")}</p>
                <div className="text-5xl font-black text-white p-4">{timeRemaining}s</div>
                <div className="h-8 flex items-center justify-center">
                  {isHighDetected ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full animate-in zoom-in duration-200">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-bold">{t("signalDetected")}</span>
                    </div>
                  ) : (
                    <Activity className="w-8 h-8 text-sky-500 animate-pulse mx-auto" />
                  )}
                </div>
              </div>
            )}

            {step === "saving" && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                <p className="text-sm font-semibold mt-4">{t("generatingProfile")}</p>
              </div>
            )}

            {step === "success" && (
              <div className="space-y-4 animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white">{t("calibrationComplete")}</h3>
                <p className="text-sm text-zinc-400">{t("successDesc")}</p>
                <Button onClick={handleFinish} className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold">
                  {t("closeBtn")}
                </Button>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>

      {/* Real-time Validation Feedback via Full-Width Virtual Keyboard */}
      {(isOpen && step !== "intro" && step !== "saving" && step !== "success") && (
        <div className="fixed bottom-0 left-0 w-full h-[12vh] min-h-[80px] max-h-[140px] z-[150] shadow-[0_-20px_40px_rgba(0,0,0,0.6)] border-t border-zinc-800/80 bg-zinc-950 animate-in slide-in-from-bottom-10 fade-in duration-500 pointer-events-auto flex flex-col">
          <div className="w-full py-1 bg-zinc-900 border-b border-zinc-800 flex justify-center items-center gap-2 relative">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">{t("liveAiMonitor")}</p>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          <VirtualKeyboard
            activeNotes={activeNotes}
            targetNotes={targetNotes}
            className="flex-1 rounded-none border-none border-t border-zinc-800/50"
          />
        </div>
      )}
    </>
  );
}
