/**
 * High-precision Web Audio Metronome Engine.
 * Uses a classic lookahead scheduler to ensure sample-accurate click timing
 * locked exactly to the timemap events.
 */
import { TimemapEntry } from '../daw/types';

export class MetronomeEngine {
  private context: AudioContext;
  private isEnabled: boolean = false;
  private isPlaying: boolean = false;
  private timemap: TimemapEntry[] = [];
  private syncToTimemap: boolean = false;
  
  private tempoParams = { tempo: 120, timeSignature: "4/4" };
  private originalTimeSignature = "4/4";
  private gainNode: GainNode;
  
  // Scheduler variables
  private syncStartTimeContext: number = 0; // The AudioContext.currentTime when playback actually starts
  private syncOffsetMsSong: number = 0; // The song time (in ms) when playback started
  private playbackRate: number = 1.0;
  
  private nextTick = { measure: 1, beat: 0 }; // 1-indexed measure, 0-indexed beat
  
  // Lookahead settings
  private lookahead: number = 25.0; // How frequently to call scheduling function (in milliseconds)
  private scheduleAheadTime: number = 0.5; // How far ahead to schedule audio (sec)
  private timerID: ReturnType<typeof setInterval> | null = null;
  private activeOscillators: OscillatorNode[] = [];

  constructor(context: AudioContext) {
    this.context = context;
    
    // Dedicated metronome volume control
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1.0; 
    this.gainNode.connect(this.context.destination);
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
  
  public getEnabled() { return this.isEnabled; }

  public setVolume(volume: number) {
    this.gainNode.gain.value = volume;
  }

  public setTempoParams(tempo: number, timeSignature: string, originalTimeSignature?: string) {
    this.tempoParams = { tempo, timeSignature };
    if (originalTimeSignature) {
        this.originalTimeSignature = originalTimeSignature;
    }
  }

  public setTimemap(timemap: TimemapEntry[]) {
    this.timemap = [...timemap].sort((a, b) => a.timeMs - b.timeMs);
  }

  public setSyncToTimemap(sync: boolean) {
    this.syncToTimemap = sync;
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = rate;
  }

  public start(offsetMs: number, syncStartTimeContext: number) {
    if (!this.isEnabled) return;
    this.stop(); // Cleanly kill any existing scheduling loop
    this.isPlaying = true;
    
    this.syncStartTimeContext = syncStartTimeContext;
    this.syncOffsetMsSong = offsetMs;
    
    // Determine which measure/beat coordinate we should start scheduling
    this.initTickAtTime(offsetMs);
    
    this.scheduler();
    this.timerID = setInterval(() => this.scheduler(), this.lookahead);
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
    
    // Immediately stop any scheduled beeps in the WebAudio queue
    for (const osc of this.activeOscillators) {
        try { osc.stop(this.context.currentTime); } catch (e) {}
        try { osc.disconnect(); } catch (e) {}
    }
    this.activeOscillators = [];
  }

  private getOriginalBeatsPerBar(): number {
    const parsed = parseInt(this.originalTimeSignature.split("/")[0], 10);
    return isNaN(parsed) ? 4 : parsed;
  }

  public getBeatsPerBar(): number {
    const parsed = parseInt(this.tempoParams.timeSignature.split("/")[0], 10);
    return isNaN(parsed) ? 4 : parsed;
  }

  private getMsPerBeat(): number {
    const msPerQuarter = 60000 / this.tempoParams.tempo;
    const denomParts = this.tempoParams.timeSignature.split("/");
    const denominator = denomParts.length > 1 ? parseInt(denomParts[1], 10) : 4;
    const validDenom = isNaN(denominator) || denominator <= 0 ? 4 : denominator;
    
    // In standard MIDI, the Tempo is Quarter Notes Per Minute (Denominator 4).
    // If we're in x/8 time, a beat is an eighth note (4/8 = 0.5x the duration of a Quarter Note).
    // If we're in x/2 time, a beat is a half note (4/2 = 2.0x the duration of a Quarter Note).
    return msPerQuarter * (4 / validDenom);
  }

  /**
   * Calculates the exact duration of one philosophical measure (bar) in seconds 
   * based on the current tempo and time signature.
   */
  public getBarDurationSec(): number {
    const beats = this.getBeatsPerBar();
    const msPerBeat = this.getMsPerBeat();
    return (beats * msPerBeat) / 1000.0;
  }

  private getSignatureForMeasure(measureTarget: number): string {
    let sig = this.tempoParams.timeSignature;
    if (this.timemap && this.timemap.length > 0) {
      for (let i = 0; i < this.timemap.length; i++) {
        if (this.timemap[i].measure <= measureTarget && this.timemap[i].timeSignature) {
          sig = this.timemap[i].timeSignature!;
        }
        if (this.timemap[i].measure > measureTarget) break;
      }
    }
    return sig;
  }

  private getBeatsPerBarForMeasure(measureTarget: number): number {
    const sig = this.getSignatureForMeasure(measureTarget);
    const parsed = parseInt(sig.split("/")[0], 10);
    return isNaN(parsed) ? 4 : parsed;
  }

  private getMsPerBeatForMeasure(measureTarget: number): number {
    const msPerQuarter = 60000 / this.tempoParams.tempo;
    const sig = this.getSignatureForMeasure(measureTarget);
    const denomParts = sig.split("/");
    const denominator = denomParts.length > 1 ? parseInt(denomParts[1], 10) : 4;
    const validDenom = isNaN(denominator) || denominator <= 0 ? 4 : denominator;
    return msPerQuarter * (4 / validDenom);
  }

  private initTickAtTime(songTimeMs: number) {
    if (this.syncToTimemap && this.timemap.length > 0) {
      let activeEvent = this.timemap[0];
      let nextEvent = null;
      
      for (let i = 0; i < this.timemap.length; i++) {
        if (this.timemap[i].timeMs <= songTimeMs) {
          activeEvent = this.timemap[i];
          nextEvent = (i + 1 < this.timemap.length) ? this.timemap[i+1] : null;
        } else {
          break;
        }
      }
      
      const beatsInActive = this.getBeatsPerBarForMeasure(activeEvent.measure);
      let measureDurationMs = this.getMsPerBeatForMeasure(activeEvent.measure) * beatsInActive;
      
      if (nextEvent) {
         measureDurationMs = nextEvent.timeMs - activeEvent.timeMs;
      } else if (this.timemap.length >= 2) {
         const idx = this.timemap.indexOf(activeEvent);
         if (idx > 0) measureDurationMs = activeEvent.timeMs - this.timemap[idx-1].timeMs;
      }
      if (measureDurationMs <= 0) measureDurationMs = 1;

      const msPerSubBeat = measureDurationMs / beatsInActive;
      
      if (songTimeMs < activeEvent.timeMs) {
         // Pre-roll extrapolation
         const diff = activeEvent.timeMs - songTimeMs;
         const beatsBeforeStart = Math.ceil(diff / msPerSubBeat);
         let startMeasure = activeEvent.measure;
         let startBeat = 0 - beatsBeforeStart;
         while (startBeat < 0) {
            startMeasure--;
            startBeat += this.getBeatsPerBarForMeasure(startMeasure);
         }
         this.nextTick = { measure: startMeasure, beat: startBeat };
         return;
      }
      
      const msSinceMeasureStart = songTimeMs - activeEvent.timeMs;
      const beatWithinMeasure = Math.floor(msSinceMeasureStart / msPerSubBeat);
      this.nextTick = { measure: activeEvent.measure, beat: beatWithinMeasure };
      return;
    }

    // Pure math logical scan
    let currentMs = 0;
    let measure = 1;
    while (true) {
        const beats = this.getBeatsPerBarForMeasure(measure);
        const msPerBeat = this.getMsPerBeatForMeasure(measure);
        const measureDur = beats * msPerBeat;
        if (currentMs + measureDur > songTimeMs) {
            const msSinceStart = songTimeMs - currentMs;
            const beat = Math.floor(msSinceStart / msPerBeat);
            this.nextTick = { measure, beat };
            return;
        }
        currentMs += measureDur;
        measure++;
    }
  }

  private getTimeOfTick(measureTarget: number, beatTarget: number): number {
    if (this.syncToTimemap && this.timemap.length > 0) {
      let mapEvent = this.timemap.find(t => t.measure === measureTarget);
      
      if (!mapEvent && measureTarget < 1) {
          mapEvent = this.timemap[0];
      }
      
      if (mapEvent) {
        const beatsPerBar = this.getBeatsPerBarForMeasure(measureTarget);
        let measureDurationMs = this.getMsPerBeatForMeasure(measureTarget) * beatsPerBar;
        
        const nextMapEvent = this.timemap.find(t => t.measure === measureTarget + 1);
        if (nextMapEvent) {
           measureDurationMs = nextMapEvent.timeMs - mapEvent.timeMs;
        } else {
           const prevMapEvent = this.timemap.find(t => t.measure === measureTarget - 1);
           if (prevMapEvent) measureDurationMs = mapEvent.timeMs - prevMapEvent.timeMs;
        }
        
        const msPerSubBeat = measureDurationMs / beatsPerBar;
        
        if (measureTarget < 1) {
            const diffMeasures = 1 - measureTarget;
            const beatsBack = (diffMeasures * beatsPerBar) - beatTarget;
            return mapEvent.timeMs - (beatsBack * msPerSubBeat);
        }
        
        return mapEvent.timeMs + (beatTarget * msPerSubBeat);
      }
    }

    let ms = 0;
    for (let m = 1; m < measureTarget; m++) {
        ms += this.getBeatsPerBarForMeasure(m) * this.getMsPerBeatForMeasure(m);
    }
    ms += beatTarget * this.getMsPerBeatForMeasure(measureTarget);
    return ms;
  }

  private advanceTick() {
      this.nextTick.beat++;
      const beatsInMeasure = this.getBeatsPerBarForMeasure(this.nextTick.measure);
      if (this.nextTick.beat >= beatsInMeasure) {
          this.nextTick.beat = 0;
          this.nextTick.measure++;
      }
  }

  private scheduler() {
    if (!this.isPlaying) return; 
    
    // Determine the max AudioContext time we should schedule up to
    const lookaheadUntilContextTime = this.context.currentTime + this.scheduleAheadTime;
    
    while (true) {
        const beatSongMs = this.getTimeOfTick(this.nextTick.measure, this.nextTick.beat);
        
        // If the beat is before the playhead, skip it
        if (beatSongMs < this.syncOffsetMsSong) {
            this.advanceTick();
            continue;
        }

        // Calculate the exact context.currentTime for this beat
        const relativeSongSecs = (beatSongMs - this.syncOffsetMsSong) / 1000.0;
        const beatContextTime = this.syncStartTimeContext + (relativeSongSecs / this.playbackRate);

        // If the calculated time is beyond our lookahead window, stop scheduling for now
        if (beatContextTime > lookaheadUntilContextTime) {
            break;
        }

        const isStrongBeat = this.nextTick.beat === 0;

        // Schedule it
        this.scheduleNote(isStrongBeat, beatContextTime);
        this.advanceTick();
    }
  }

  private scheduleNote(isStrongBeat: boolean, time: number) {
    const osc = this.context.createOscillator();
    const env = this.context.createGain();

    osc.connect(env);
    env.connect(this.gainNode);

    if (isStrongBeat) {
      osc.frequency.value = 1500.0; // High click
    } else {
      osc.frequency.value = 800.0; // Low click
    }

    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(1, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.start(time);
    osc.stop(time + 0.1);
    
    this.activeOscillators.push(osc);
    osc.onended = () => {
        const index = this.activeOscillators.indexOf(osc);
        if (index > -1) {
            this.activeOscillators.splice(index, 1);
        }
    };
  }
}

