/**
 * MidiPlayerSingleton — Global singleton that holds a reference to the active
 * <midi-player> element. Because Next.js client-side navigation may not unmount
 * components, this singleton ensures we can always stop MIDI from any context
 * (e.g. route-change listener, layout cleanup).
 *
 * Uses both ref-based tracking AND DOM query fallback to handle cases where
 * the ref becomes stale (e.g. component unmount without cleanup).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let playerInstance: any = null;
let audioManagerInstance: { stop: () => void } | null = null;

export const MidiPlayerSingleton = {
  /** Register the active MIDI player element */
  setPlayer(player: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    playerInstance = player;
  },

  /** Register the active AudioManager (for stopping audio tracks too) */
  setAudioManager(manager: { stop: () => void } | null) {
    audioManagerInstance = manager;
  },

  /** Get the current MIDI player instance */
  getPlayer() {
    return playerInstance;
  },

  /** Stop MIDI playback — uses ref + DOM fallback */
  stopMidi() {
    // 1. Try via registered ref
    if (playerInstance) {
      try {
        playerInstance.stop();
        playerInstance.currentTime = 0;
      } catch {
        // Player may already be destroyed
      }
    }
    // 2. DOM fallback: find ALL <midi-player> elements and stop them
    if (typeof document !== 'undefined') {
      try {
        const players = document.querySelectorAll('midi-player');
        players.forEach((el: any) => {
          try {
            el.stop?.();
            if (el.currentTime !== undefined) el.currentTime = 0;
          } catch {}
        });
      } catch {}
    }
  },

  /** Stop all audio (MIDI + AudioManager) */
  stopAll() {
    this.stopMidi();
    if (audioManagerInstance) {
      try {
        audioManagerInstance.stop();
      } catch {
        // Manager may already be destroyed
      }
    }
  },

  /** Full cleanup — stop and release references */
  cleanup() {
    this.stopAll();
    playerInstance = null;
    audioManagerInstance = null;
  },
};
