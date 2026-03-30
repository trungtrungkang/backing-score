"use client";

import { getFileViewUrl } from "@/lib/appwrite";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@/i18n/routing";
import { ChevronLeft, Play, Pause, Sun, Moon, Activity, TimerReset } from "lucide-react";
import { MusicXMLVisualizer } from "@/components/editor/MusicXMLVisualizer";
import { TrackList } from "@/components/editor/TrackList";
import { AudioManager, type TrackParams } from "@/lib/audio/AudioManager";
import type { DAWPayload } from "@/lib/daw/types";
import { cn } from "@/lib/utils";

interface LiveShellProps {
  projectId: string;
  projectName: string;
  payload: DAWPayload;
}

export function LiveShell({ projectId, projectName, payload }: LiveShellProps) {
  const audioManagerRef = useRef<AudioManager | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [pitchShift, setPitchShift] = useState(0);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [isPreRollEnabled, setIsPreRollEnabled] = useState(false);
  const [timeSignature, setTimeSignature] = useState(payload.metadata?.timeSignature || "4/4");

  const requestRef = useRef<number>(0);
  const prevFilesRef = useRef<string>("");
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark on Live stage
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({});
  const [soloedTracks, setSoloedTracks] = useState<Record<string, boolean>>({});
  const [trackVolumes, setTrackVolumes] = useState<Record<string, number>>({});
  const [trackOffsets, setTrackOffsets] = useState<Record<string, number>>({});
  const [isTracksExpanded, setIsTracksExpanded] = useState(true);
  const [audioReady, setAudioReady] = useState(true);

  useEffect(() => {
    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
      const tempo = payload.metadata?.tempo || 120;
      audioManagerRef.current.getMetronome()?.setTempoParams(tempo, timeSignature, payload.metadata?.timeSignature || "4/4");
    }
    
    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
        audioManagerRef.current = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      // Reset the file hash so if the component remounts (e.g. React StrictMode),
      // the load effect will correctly detect a change and reload tracks.
      prevFilesRef.current = "";
    };
  }, []);

  // Sync the timemap down to the metronome engine for variable tempo support
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.getMetronome()?.setTimemap(payload.notationData?.timemap || []);
    }
  }, [payload.notationData?.timemap]);

  useEffect(() => {
    if (!audioManagerRef.current) return;

    const validTracks = payload.audioTracks.filter(t => !!t.fileId);
    const currentFiles = validTracks.map(t => `${t.id}:${t.fileId}`).join(',');
    
    if (currentFiles === prevFilesRef.current) return;
    prevFilesRef.current = currentFiles;

    if (validTracks.length === 0) {
      audioManagerRef.current.stop();
      setDurationMs(0);
      return;
    }

    const tracksToLoad: TrackParams[] = validTracks.map(t => ({
      id: t.id,
      name: t.name,
      url: getFileViewUrl(t.fileId!),
      volume: t.volume ?? 1,
      pan: t.pan ?? 0,
      muted: t.muted ?? false,
      solo: t.solo ?? false,
      offsetMs: t.offsetMs ?? 0,
    }));

    setLoadingAudio(true);
    audioManagerRef.current.loadTracks(tracksToLoad, (loading, loadedCount, total) => {
      // Prevent crash if component unmounts before loading completes
      if (!audioManagerRef.current) return;
      
      if (!loading) {
        setLoadingAudio(false);
        setDurationMs(audioManagerRef.current.getDurationMs());
        
        // Initialize muted state from payload
        const initialMutes: Record<string, boolean> = {};
        const initialSolos: Record<string, boolean> = {};
        const initialVolumes: Record<string, number> = {};
        const initialOffsets: Record<string, number> = {};
        
        validTracks.forEach(t => {
          initialMutes[t.id] = t.muted ?? false;
          initialSolos[t.id] = t.solo ?? false;
          initialVolumes[t.id] = t.volume ?? 1;
          initialOffsets[t.id] = t.offsetMs ?? 0;
        });
        setMutedTracks(initialMutes);
        setSoloedTracks(initialSolos);
        setTrackVolumes(initialVolumes);
        setTrackOffsets(initialOffsets);
        
        // Force the Web Audio buffers to become available for TrackList rendering
        setAudioReady(true);
      }
    });
  }, [payload.audioTracks]);

  const updatePosition = useCallback(() => {
    if (audioManagerRef.current && isPlaying) {
      setPositionMs(audioManagerRef.current.getCurrentPositionMs());
      requestRef.current = requestAnimationFrame(updatePosition);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updatePosition);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioManagerRef.current) {
        setPositionMs(audioManagerRef.current.getCurrentPositionMs());
      }
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, updatePosition]);

  const handlePlayPause = () => {
    if (!audioManagerRef.current) return;
    if (isPlaying) {
      audioManagerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioManagerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePlaybackRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (audioManagerRef.current) {
      audioManagerRef.current.setPlaybackRate(rate);
    }
  };

  const handlePitchShiftChange = useCallback((semitones: number) => {
    setPitchShift(semitones);
    if (audioManagerRef.current) {
      audioManagerRef.current.setPitchShift(semitones);
    }
  }, []);

  const handleMetronomeToggle = useCallback((enabled: boolean) => {
    setIsMetronomeEnabled(enabled);
    if (!audioManagerRef.current) return;
    
    audioManagerRef.current.setMetronomeEnabled(enabled);
  }, [isPlaying]);

  const handlePreRollToggle = useCallback((enabled: boolean) => {
    setIsPreRollEnabled(enabled);
    if (!audioManagerRef.current) return;
    
    audioManagerRef.current.setPreRollEnabled(enabled);
  }, []);

  const handleTimeSignatureChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSig = e.target.value;
    setTimeSignature(newSig);
    if (audioManagerRef.current) {
      const currentBpm = payload.metadata?.tempo || 120;
      audioManagerRef.current.getMetronome()?.setTempoParams(currentBpm, newSig, payload.metadata?.timeSignature || "4/4");
    }
  }, [payload.metadata?.tempo]);

  const toggleTrackMute = (trackId: string, isMuted: boolean) => {
    setMutedTracks(prev => ({ ...prev, [trackId]: isMuted }));
    if (audioManagerRef.current) {
      audioManagerRef.current.setMute(trackId, isMuted);
    }
  };

  const toggleTrackSolo = (trackId: string, isSolo: boolean) => {
    setSoloedTracks(prev => ({ ...prev, [trackId]: isSolo }));
    if (audioManagerRef.current) {
      audioManagerRef.current.setSolo(trackId, isSolo);
    }
  };

  const handleVolumeChange = (trackId: string, volume: number) => {
    setTrackVolumes(prev => ({ ...prev, [trackId]: volume }));
    if (audioManagerRef.current) {
      audioManagerRef.current.setVolume(trackId, volume);
    }
  };

  const handleOffsetChange = (trackId: string, offsetMs: number) => {
    setTrackOffsets(prev => ({ ...prev, [trackId]: offsetMs }));
    if (audioManagerRef.current) {
      audioManagerRef.current.setTrackOffset(trackId, offsetMs);
    }
  };

  const handleSeek = useCallback((ms: number) => {
    if (audioManagerRef.current) {
      audioManagerRef.current.seek(ms);
      setPositionMs(ms);
    }
  }, []);

  const scoreFileId = payload.notationData?.fileId;
  const EMPTY_TIMEMAP: never[] = [];

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn(
      "flex flex-col h-screen fixed inset-0 w-full z-[100] bg-black text-white overflow-hidden select-none",
      isDarkMode ? "dark-theme" : ""
    )}>
      {/* Live Header - Minimalist */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/p/${projectId}`} className="text-zinc-400 hover:text-white transition-colors" title="Exit Live Mode">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="font-bold text-lg tracking-wide truncate max-w-sm">{projectName}</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-red-600/20 text-red-500 text-xs font-bold tracking-widest border border-red-600/30 uppercase">
            Live
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content Area - Fullscreen Score */}
      <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
        <MusicXMLVisualizer 
          scoreFileId={scoreFileId} 
          positionMs={positionMs}
          isPlaying={isPlaying}
          timemap={payload.notationData?.timemap || EMPTY_TIMEMAP}
          timemapSource={payload.notationData?.timemapSource}
          payloadTempo={payload.metadata?.tempo || 120}
          measureMap={payload.notationData?.measureMap}
          onSeek={(pos) => audioManagerRef.current?.seek(pos)}
          isDarkMode={isDarkMode}
        />
        
        {loadingAudio && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-zinc-300 font-bold tracking-[0.2em] uppercase text-sm animate-pulse">Initializing Audio Engine</p>
            </div>
          </div>
        )}
      </div>

      {/* Live Transport Bar - Giant Touch Targets and Safe Area Padding */}
      <div className="bg-zinc-950 border-t border-zinc-800 shrink-0 flex items-center px-8 relative py-6 min-h-[120px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* Giant Play/Pause */}
        <button
          onClick={handlePlayPause}
          disabled={loadingAudio}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl absolute -top-8 left-8 border-4 border-zinc-950",
            isPlaying 
              ? "bg-zinc-800 text-white hover:bg-zinc-700 active:scale-95" 
              : "bg-white text-black hover:bg-zinc-200 active:scale-95",
            loadingAudio && "opacity-50 cursor-not-allowed"
          )}
        >
          {isPlaying ? (
            <Pause className="w-10 h-10 fill-current" />
          ) : (
            <Play className="w-10 h-10 fill-current ml-1" />
          )}
        </button>

        {/* Progress Display */}
        <div className="ml-32 flex-1 flex flex-col gap-2">
          <div className="flex justify-between items-center text-zinc-400 font-mono text-xl tracking-wider font-medium">
            <span className={isPlaying ? "text-white" : ""}>{formatTime(positionMs)}</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-zinc-500 font-bold tracking-widest">Key</span>
                <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-md overflow-hidden h-7">
                  <button 
                    onClick={() => handlePitchShiftChange(pitchShift - 1)}
                    className="w-8 h-full flex items-center justify-center hover:bg-zinc-800 active:bg-zinc-700 transition-colors font-mono text-zinc-300"
                  >-</button>
                  <div className="w-10 text-center text-sm font-mono text-blue-400 font-bold">
                    {pitchShift > 0 ? `+${pitchShift}` : pitchShift}
                  </div>
                  <button 
                    onClick={() => handlePitchShiftChange(pitchShift + 1)}
                    className="w-8 h-full flex items-center justify-center hover:bg-zinc-800 active:bg-zinc-700 transition-colors font-mono text-zinc-300"
                  >+</button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-zinc-500 font-bold tracking-widest hidden sm:inline">Speed</span>
                <select
                  value={playbackRate}
                  onChange={handlePlaybackRateChange}
                  className="bg-zinc-900 border border-zinc-700 text-sm rounded-md px-2 h-7 outline-none text-zinc-300 font-sans focus:border-blue-500 cursor-pointer"
                  title="Playback Speed"
                >
                  {[0.5, 0.75, 1, 1.25, 1.5].map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}x
                    </option>
                  ))}
                </select>
              </div>

              {/* Metronome & Time Signature */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMetronomeToggle(!isMetronomeEnabled)}
                  className={cn(
                    "p-1.5 rounded-md transition-colors flex items-center justify-center border",
                    isMetronomeEnabled 
                      ? "bg-blue-600/30 text-blue-400 border-blue-500/50 hover:bg-blue-600/40" 
                      : "bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:bg-zinc-800"
                  )}
                  title="Toggle Metronome"
                >
                  <Activity className="w-4 h-4" />
                </button>
                <select
                  value={timeSignature}
                  onChange={handleTimeSignatureChange}
                  className="bg-zinc-900 border border-zinc-700 text-xs rounded-md px-1.5 h-7 outline-none text-zinc-400 font-mono focus:border-blue-500 cursor-pointer"
                  title="Time Signature"
                >
                  <option value="2/4">2/4</option>
                  <option value="3/4">3/4</option>
                  <option value="4/4">4/4</option>
                  <option value="6/8">6/8</option>
                </select>
              </div>

              <span className="ml-2">{formatTime(durationMs)}</span>
            </div>
          </div>
          
          <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden relative">
            <div 
              className="absolute top-0 left-0 bottom-0 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-100 ease-linear"
              style={{ width: `${durationMs > 0 ? (positionMs / durationMs) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Track Mixer - Docked inside transport area */}
      <div 
        className="bg-zinc-950 border-t border-zinc-800 shrink-0 flex flex-col transition-all duration-300 ease-in-out relative z-10"
        style={{ height: isTracksExpanded ? 300 : 36 }}
      >
        <TrackList
          tracks={payload.audioTracks}
          muteByTrackId={mutedTracks}
          soloByTrackId={soloedTracks}
          onMuteChange={toggleTrackMute}
          onSoloChange={toggleTrackSolo}
          onVolumeChange={handleVolumeChange}
          onOffsetChange={handleOffsetChange}
          audioManager={audioManagerRef.current}
          positionMs={positionMs}
          durationMs={durationMs}
          bpm={payload.metadata?.tempo || 120}
          timemap={payload.notationData?.timemap || EMPTY_TIMEMAP}
          timeSignature={{ 
            numerator: parseInt((payload.metadata?.timeSignature || "4/4").split("/")[0], 10) || 4, 
            denominator: parseInt((payload.metadata?.timeSignature || "4/4").split("/")[1], 10) || 4 
          }}
          isExpanded={isTracksExpanded}
          onToggleExpand={() => setIsTracksExpanded(!isTracksExpanded)}
          pitchShift={pitchShift}
          onPitchShiftChange={handlePitchShiftChange}
          audioReady={audioReady}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
