/**
 * High-performance Audio Engine based on the Web Audio API.
 * Handles loading, synchronizing, and playing multiple audio stems.
 */
import { MetronomeEngine } from './MetronomeEngine';
import { fetchWithRetry } from '../utils';

export interface TrackParams {
  id: string;
  name: string;
  url: string; // The URL to fetch the audio file from
  volume?: number; // 0.0 to 1.0 (default 1.0)
  pan?: number; // -1.0 to 1.0 (default 0.0)
  muted?: boolean;
  solo?: boolean;
  offsetMs?: number;
}

interface TrackNode {
  buffer: AudioBuffer;
  source?: AudioBufferSourceNode; // the actively playing source
  stNode?: any; // internal SoundTouchNode instance
  gainNode?: GainNode;
  pannerNode?: StereoPannerNode;
  params: TrackParams;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private tracks: Map<string, TrackNode> = new Map();

  private isPlaying: boolean = false;
  private durationMs: number = 0;

  private startTime: number = 0;
  private pauseTime: number = 0;
  private offsetTime: number = 0; // The current absolute cursor position within the SONG in seconds, updated during pause/seek
  private isPreRollEnabled = false;
  private playbackRate: number = 1.0;
  private workletLoaded = false;
  private SoundTouchNodeClass?: any;
  private pitchShift: number = 0; // Transpose semitones

  // A-B Looping
  private isLooping: boolean = false;
  private loopStartMs: number = 0;
  private loopEndMs: number = 0;
  private loopIntervalId: ReturnType<typeof setInterval> | null = null;

  // Click Track
  private metronome: MetronomeEngine | null = null;
  private globalMuted: boolean = false;

  constructor() { }

  private initContext() {
    if (!this.context) {
      if (typeof window !== "undefined") {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.metronome = new MetronomeEngine(this.context);
        
        // Listen for OS-level interrupts (e.g. iOS screen lock or backgrounding)
        this.context.onstatechange = () => {
           console.log("[AudioManager] OS AudioContext state change:", this.context?.state);
           if (this.context?.state === 'suspended' || this.context?.state === 'interrupted') {
               // If the OS forcibly paused the audio hardware, we must sync our logical state
               if (this.isPlaying) {
                   console.warn("[AudioManager] iOS suspended audio hardware. Forcing internal pause.");
                   this.pause();
               }
           }
        };
      } else {
        throw new Error("AudioManager can only be initialized in the browser.");
      }
    }
  }

  /**
   * Universal iOS/Safari Web Audio Unlocker.
   * MUST be called synchronously inside a user gesture (e.g. onClick).
   */
  public async unlockiOSAudio() {
    this.initContext();
    if (!this.context) return;
    try {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      // Play 1 sample of silence to physically unlock the iOS audio hardware pipeline
      const buffer = this.context.createBuffer(1, 1, 22050);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start(0);
    } catch (e) {
      console.warn("[AudioManager] iOS audio unlock failed", e);
    }
  }

  private getDecodeContext(): AudioContext | OfflineAudioContext {
    if (this.context) return this.context;
    return new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(1, 44100, 44100);
  }

  public async loadTracks(tracksToLoad: TrackParams[], onProgress?: (loading: boolean, loadedCount: number, total: number) => void): Promise<void> {
    this.stop();
    this.tracks.clear();
    this.durationMs = 0;

    if (onProgress) onProgress(true, 0, tracksToLoad.length);

    let loadedCount = 0;
    const decodeContext = this.getDecodeContext();

    await Promise.all(tracksToLoad.map(async (trackParams) => {
      try {
        const response = await fetchWithRetry(trackParams.url);
        if (!response.ok) throw new Error(`Failed to fetch ${trackParams.url}: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        console.log(`[AudioManager] Fetched ${trackParams.name}: ${arrayBuffer.byteLength} bytes`);

        // Use promise wrapper for legacy Safari compatibility
        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          decodeContext.decodeAudioData(
            arrayBuffer.slice(0), // slice to ensure fresh copy
            (buffer) => resolve(buffer),
            (err) => reject(err)
          );
        });

        console.log(`[AudioManager] Decoded ${trackParams.name}: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels}ch @ ${audioBuffer.sampleRate}Hz`);

        let trackDurationMs = audioBuffer.duration * 1000;
        if (trackParams.offsetMs) {
          trackDurationMs += trackParams.offsetMs;
        }

        if (trackDurationMs > this.durationMs) {
          this.durationMs = trackDurationMs;
        }

        this.tracks.set(trackParams.id, {
          buffer: audioBuffer,
          params: trackParams,
        });

      } catch (err) {
        console.error(`[AudioManager] Error loading track ${trackParams.id}:`, err);
      } finally {
        loadedCount++;
        if (onProgress) onProgress(true, loadedCount, tracksToLoad.length);
      }
    }));

    console.log(`[AudioManager] loadTracks complete. ${this.tracks.size} tracks loaded, duration=${this.durationMs}ms`);
    this.updateMuteSoloVolumes();
    if (onProgress) onProgress(false, loadedCount, tracksToLoad.length);
  }

  private ensureNodes() {
    this.initContext();
    if (!this.context) return;

    this.tracks.forEach((track, id) => {
      if (!track.gainNode || !track.pannerNode) {
        console.log(`[AudioManager] Creating nodes for track ${id} (${track.params.name}), volume=${track.params.volume ?? 1}`);
        track.pannerNode = this.context!.createStereoPanner();
        track.pannerNode.pan.value = track.params.pan || 0;

        track.gainNode = this.context!.createGain();
        track.gainNode.gain.value = track.params.volume ?? 1;

        track.pannerNode.connect(track.gainNode);
        track.gainNode.connect(this.context!.destination);
        console.log(`[AudioManager] Nodes connected for ${track.params.name}, gain=${track.gainNode.gain.value}`);
      }
    });
    this.updateMuteSoloVolumes();
  }

  public getDurationMs(): number {
    return this.tracks.size > 0 ? this.durationMs : 0; // 30 minutes fallback moved to useScoreEngine
  }

  public async play() {
    if (this.globalMuted) return;
    this.initContext();
    console.log(`[AudioManager] play() called. tracks=${this.tracks.size}, context=${this.context?.state}, isPlaying=${this.isPlaying}`);
    if (!this.context || this.isPlaying) return;

    if (this.context.state === 'suspended') {
      console.log('[AudioManager] Resuming suspended context...');
      await this.context.resume();
      console.log('[AudioManager] Context state after resume:', this.context.state);
    }

    // Phase 6.2 Pitch-preserving Time-stretching
    if (!this.workletLoaded) {
      try {
        await this.context.audioWorklet.addModule('/soundtouch-processor.js');
        const stModule = await import('@soundtouchjs/audio-worklet');
        this.SoundTouchNodeClass = stModule.SoundTouchNode;
        this.workletLoaded = true;
        console.log('[AudioManager] SoundTouch worklet loaded successfully.');
      } catch (err) {
        console.warn('[AudioManager] Failed to load SoundTouch worklet, falling back to basic playback:', err);
      }
    }

    this.ensureNodes();

    this.isPlaying = true;
    this.startTime = this.context.currentTime;

    // Phase 12.2: Pre-Roll logic.
    // We only trigger pre-roll if isPreRollEnabled is true, and the playhead is exactly at 0.
    let preRollDelaySec = 0;
    if (this.isPreRollEnabled && this.offsetTime === 0 && this.metronome) {
        preRollDelaySec = this.metronome.getBarDurationSec() / this.playbackRate;
        console.log(`[AudioManager] PreRoll Active: Delaying audio tracks by ${preRollDelaySec.toFixed(3)}s`);
    }

    const syncStartTime = this.context.currentTime + 0.05 + preRollDelaySec;

    this.tracks.forEach((trackNode, id) => {
      const source = this.context!.createBufferSource();
      source.buffer = trackNode.buffer;

      let finalSource: AudioNode = source;

      if (this.workletLoaded && this.SoundTouchNodeClass) {
        try {
          const stNode = new this.SoundTouchNodeClass(this.context!);
          // To preserve pitch while altering rate, we change the source playbackRate and stNode playbackRate together
          stNode.playbackRate.value = this.playbackRate;
          source.playbackRate.value = this.playbackRate;

          // Apply transpose
          const pitchRatio = Math.pow(2, this.pitchShift / 12);
          if (stNode.pitch && typeof stNode.pitch.value !== 'undefined') {
            stNode.pitch.value = pitchRatio;
          } else if (stNode.parameters && stNode.parameters.get('pitch')) {
            stNode.parameters.get('pitch').value = pitchRatio;
          }

          source.connect(stNode);
          finalSource = stNode;
          trackNode.stNode = stNode;
        } catch (e) {
          console.error("[AudioManager] Error creating SoundTouchNode:", e);
          source.playbackRate.value = this.playbackRate;
        }
      } else {
        source.playbackRate.value = this.playbackRate;
      }

      if (trackNode.pannerNode) {
        finalSource.connect(trackNode.pannerNode);
      } else {
        finalSource.connect(this.context!.destination);
      }

      const trackOffsetSec = (trackNode.params.offsetMs || 0) / 1000;
      let trackStartWhen = syncStartTime;
      let trackBufferOffset = this.offsetTime;

      if (this.offsetTime < trackOffsetSec) {
        // Playhead is before the track starts
        trackStartWhen = syncStartTime + ((trackOffsetSec - this.offsetTime) / this.playbackRate);
        trackBufferOffset = 0;
      } else {
        // Playhead is past the track start time, skip into the buffer
        trackBufferOffset = this.offsetTime - trackOffsetSec;
      }

      // Check if bufferOffset is beyond the buffer duration
      if (trackBufferOffset < trackNode.buffer.duration) {
         source.start(trackStartWhen, trackBufferOffset);
         trackNode.source = source;
      }
    });

    if (this.metronome && this.metronome.getEnabled()) {
        // If there is a preRollDelaySec, we start the metronome ticking immediately (pre-emptively)
        // by pushing the MetronomeEngine's "Song start time" into the future relative to its tick schedule.
        // E.g. We tell the metronome the song actually started `preRollDelaySec` ago, so it ticks negative beats.
        const metronomeStartOffsetMs = this.offsetTime * 1000 - (preRollDelaySec * 1000 * this.playbackRate);
        this.metronome.start(metronomeStartOffsetMs, this.context.currentTime + 0.05);
    }

    this.updateMuteSoloVolumes();
    this.manageLoopCheck();
    console.log(`[AudioManager] Playback started. ${this.tracks.size} sources scheduled at ${syncStartTime.toFixed(3)}s`);
  }

  public pause() {
    if (!this.context) return;
    
    // Always defensively stop the metronome when paused/stopped
    if (this.metronome) this.metronome.stop();

    if (!this.isPlaying) return;

    // Grab the wrapped, accurate position from the loop engine before pausing
    const truePosMs = this.getCurrentPositionMs();

    this.isPlaying = false;
    this.pauseTime = this.context.currentTime;
    this.offsetTime = truePosMs / 1000;
    this.manageLoopCheck();
    
    if (this.metronome) this.metronome.stop();

    this.tracks.forEach((trackNode) => {
      if (trackNode.source) {
        try {
          trackNode.source.stop();
        } catch (e) { /* ignore if already ended */ }
        trackNode.source.disconnect();
        trackNode.source = undefined;
      }
      if (trackNode.stNode) {
        trackNode.stNode.disconnect();
        trackNode.stNode = undefined;
      }
    });
  }

  public stop() {
    if (!this.context) return;
    this.pause();
    this.offsetTime = 0;
  }

  public getCurrentPositionMs(): number {
    if (!this.isPlaying || !this.context) {
      return this.offsetTime * 1000;
    }
    const now = this.context.currentTime;
    
    // We must account for the preRoll delay in the UI time calculation
    // When playing, context.currentTime moves forward immediately, but audio hasn't started yet.
    let preRollOffsetSec = 0;
    if (this.isPreRollEnabled && this.offsetTime === 0 && this.metronome) {
        preRollOffsetSec = this.metronome.getBarDurationSec() / this.playbackRate;
    }

    const unscaledElapsedSec = (now - this.startTime) - preRollOffsetSec;
    let posMs = (this.offsetTime + unscaledElapsedSec * this.playbackRate) * 1000;

    // Native WebAudio looping wraps the audio, so we must wrap the UI time too
    if (this.isLooping && this.loopEndMs > this.loopStartMs) {
      if (posMs >= this.loopEndMs) {
        const loopDurationMs = this.loopEndMs - this.loopStartMs;
        const timeSinceLoopStart = posMs - this.loopStartMs;
        posMs = this.loopStartMs + (timeSinceLoopStart % loopDurationMs);
      }
    }

    return posMs;
  }

  public async seek(timeMs: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }

    this.offsetTime = Math.max(0, Math.min(timeMs / 1000, this.durationMs / 1000));

    if (wasPlaying) {
      await this.play();
    }
  }

  public setVolume(trackId: string, volume: number) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.params.volume = volume;
      this.updateMuteSoloVolumes();
    }
  }

  public setPan(trackId: string, pan: number) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.params.pan = pan;
      if (track.pannerNode) track.pannerNode.pan.value = pan;
    }
  }

  public setMute(trackId: string, muted: boolean) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.params.muted = muted;
      this.updateMuteSoloVolumes();
    }
  }

  public setTrackOffset(trackId: string, offsetMs: number) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.params.offsetMs = offsetMs;
      
      let maxDuration = 0;
      this.tracks.forEach(t => {
        const d = (t.buffer.duration * 1000) + (t.params.offsetMs || 0);
        if (d > maxDuration) maxDuration = d;
      });
      this.durationMs = maxDuration;
    }
  }

  public setSolo(trackId: string, solo: boolean) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.params.solo = solo;
      this.updateMuteSoloVolumes();
    }
  }

  private updateMuteSoloVolumes() {
    let anySolo = false;
    this.tracks.forEach((t) => {
      if (t.params.solo) anySolo = true;
    });

    this.tracks.forEach((t) => {
      let isEffectivelyMuted = false;

      if (t.params.muted) {
        isEffectivelyMuted = true;
      } else if (anySolo && !t.params.solo) {
        isEffectivelyMuted = true;
      }

      const targetGain = isEffectivelyMuted ? 0 : (t.params.volume ?? 1);

      if (t.gainNode) {
        t.gainNode.gain.value = targetGain;
      }
    });
  }

  // --- Phase 6 Features ---

  /** Returns the decoded AudioBuffer for rendering Waveforms */
  public getBuffer(trackId: string): AudioBuffer | undefined {
    return this.tracks.get(trackId)?.buffer;
  }

  /** Set global playback rate for all tracks (e.g. 0.5x, 1x) */
  public setPlaybackRate(rate: number) {
    if (rate <= 0) return;

    // If playing, we need to update offsetTime before changing rate
    // so the time elapsed so far at the old rate is locked in.
    if (this.isPlaying && this.context) {
      const truePosMs = this.getCurrentPositionMs();
      this.offsetTime = truePosMs / 1000;
      this.startTime = this.context.currentTime;
    }

    this.playbackRate = rate;

    // Apply to actively playing sources
    if (this.isPlaying) {
      this.tracks.forEach(t => {
        if (t.source) t.source.playbackRate.value = this.playbackRate;
        if (t.stNode) {
          t.stNode.playbackRate.value = this.playbackRate;
        }
      });

      if (this.metronome && this.metronome.getEnabled()) {
        this.metronome.setPlaybackRate(rate);
        this.metronome.start(this.offsetTime * 1000, this.context!.currentTime);
      }
    } else {
      if (this.metronome) {
        this.metronome.setPlaybackRate(rate);
      }
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  /**
   * Shift pitch by N semitones (e.g., -1 for down half step, +2 for up whole step).
   * Works only when SoundTouchJS is successfully loaded.
   */
  public setPitchShift(semitones: number) {
    this.pitchShift = semitones;

    // Convert semitones to ratio
    const pitchRatio = Math.pow(2, this.pitchShift / 12);

    // Apply to actively playing sources
    if (this.isPlaying) {
      this.tracks.forEach(t => {
        if (t.stNode) {
          if (t.stNode.pitch && typeof t.stNode.pitch.value !== 'undefined') {
            t.stNode.pitch.value = pitchRatio;
          } else if (t.stNode.parameters && t.stNode.parameters.get('pitch')) {
            t.stNode.parameters.get('pitch').value = pitchRatio;
          }
        }
      });
    }
  }

  public getPitchShift(): number {
    return this.pitchShift;
  }

  // --- Phase 7.1 Looping ---

  public setLooping(enabled: boolean) {
    this.isLooping = enabled;
    this.manageLoopCheck();
  }

  public setLoopPoints(startMs: number, endMs: number) {
    if (startMs >= endMs || endMs <= 0) return;
    this.loopStartMs = startMs;
    this.loopEndMs = endMs;
  }

  public setPreRollEnabled(enabled: boolean) {
    this.isPreRollEnabled = enabled;
  }

  private manageLoopCheck() {
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }

    if (this.isPlaying && this.isLooping && this.loopEndMs > this.loopStartMs) {
      // 30ms interval + 40ms lookahead ensures we jump back without hearing the transient of the next downbeat
      this.loopIntervalId = setInterval(() => {
        const pos = this.getCurrentPositionMs();
        // Fallback target: don't seek if we are too close to the start to prevent rapid glitching
        const targetMs = Math.max(this.loopStartMs + 50, this.loopEndMs - 40);
        if (pos >= targetMs) {
          this.seek(this.loopStartMs);
        }
      }, 30);
    }
  }

  // --- Phase 8.1 Metronome ---
  public getMetronome(): MetronomeEngine | null {
      if (!this.metronome) {
          try { this.initContext(); } catch(e) {}
      }
      return this.metronome;
  }
  
  public setGlobalMute(muted: boolean) {
    this.globalMuted = muted;
    if (muted) {
       this.pause();
    }
  }

  public setMetronomeEnabled(enabled: boolean) {
    if (!this.metronome) {
        try { this.initContext(); } catch(e) {}
    }
    if (!this.metronome) return;
    this.metronome.setEnabled(enabled);
    if (enabled && this.isPlaying && this.context) {
      this.metronome.start(this.getCurrentPositionMs(), this.context.currentTime);
    } else {
      this.metronome.stop();
    }
  }
}
