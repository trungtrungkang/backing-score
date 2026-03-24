/**
 * DAW data model types for the refactored Backing & Score application.
 * Focused on Audio Stems + MusicXML playback and practice.
 */

export interface TrackBase {
  id: string;
  name: string;
  type?: "audio" | "midi"; // Default is "audio" if missing for backward compatibility
  muted?: boolean;
  solo?: boolean;
  volume?: number; // 0.0 to 1.0
  pan?: number; // -1.0 to 1.0
}

export interface AudioTrack extends TrackBase {
  /** Storage file ID in Appwrite for the audio stem (e.g., Drums.wav) */
  fileId?: string;
  /** Optional blob URL during current session before upload */
  blobUrl?: string; 
  /** Time offset in milliseconds to nudge the audio forward or backward */
  offsetMs?: number;
}

export interface FileMetadata {
  name?: string;
  artist?: string;
  tempo?: number;
  timeSignature?: string; // e.g. "4/4", "3/4"
  keySignature?: string; // e.g. "C Maj", "A Min"
  syncToTimemap?: boolean; // Toggles Elastic Timeline Grid vs Strict BPM Grid
  scoreSynthVolume?: number;
  scoreSynthMuted?: boolean;
  scoreSynthSolo?: boolean;
  scoreSynthOffsetMs?: number;
  scoreMidiInstrumentOverrides?: Record<number, number>; // trackIndex → GM program (1-indexed)
  scoreMidiPerTrackVolume?: Record<number, number>; // trackIndex → volume (0-1)
}

export interface TimemapEntry {
  timeMs: number;
  measure: number;
  timeSignature?: string; // Optional dynamic meter override (e.g. "6/8")
  tempo?: number; // Optional dynamic tempo override (BPM) at this measure
  durationInQuarters?: number; // Actual duration of this measure in quarter notes (for pickups/anacrusis)
}

export interface NotationData {
  type: "music-xml";
  /** Appwrite storage file ID for the score */
  fileId?: string;
  /** Mapping of audio time (ms) to MusicXML measure numbers */
  timemap: TimemapEntry[];
  /** Whether timemap was created manually by user ('manual') or auto-generated ('auto').
   *  When 'manual', timeMs values are authoritative and should not be overridden. */
  timemapSource?: "auto" | "manual";
  /** Optional mapping from latent playback measure index to physical printed measure index */
  measureMap?: Record<number, number>;
}

/** 
 * New Project payload (DAW model). Stored as JSON string in Appwrite ProjectDocument.payload. 
 */
export interface DAWPayload {
  version: number;
  metadata: FileMetadata;
  type: "multi-stems" | "backing-track";
  audioTracks: AudioTrack[];
  notationData?: NotationData;
}

/** Default empty DAW payload for a new project */
export function defaultDAWPayload(): DAWPayload {
  return {
    version: 2, // Upgraded version for Stems + MusicXML Architecture
    metadata: {
      syncToTimemap: true,
      tempo: 120,
    },
    type: "multi-stems",
    audioTracks: [],
    notationData: {
      type: "music-xml",
      timemap: [],
    }
  };
}

/**
 * Normalize an unknown payload from storage into the v2 DAWPayload.
 * Includes some backward compatibility fallbacks if legacy structures are found.
 */
export function normalizePayload(raw: any | null): DAWPayload {
  if (!raw || typeof raw !== "object") {
    return defaultDAWPayload();
  }
  
  // Clean initialization
  const payload = defaultDAWPayload();

  // Basic attributes
  if (typeof raw.version === "number") payload.version = raw.version;
  if (raw.type === "multi-stems" || raw.type === "backing-track") {
    payload.type = raw.type;
  }
  
  // Metadata mapping
  if (raw.metadata && typeof raw.metadata === "object") {
    payload.metadata = raw.metadata;
  } else if (typeof raw.name === "string") {
    payload.metadata.name = raw.name; // Legacy migration
  }

  // Audio Tracks mapping
  if (Array.isArray(raw.audioTracks)) {
    payload.audioTracks = raw.audioTracks;
  } else if (Array.isArray(raw.tracks)) {
    // Migration from legacy DAW tracks
    payload.audioTracks = raw.tracks
      .filter((t: any) => t.type === "audio")
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type === "midi" ? "midi" : "audio",
        muted: t.mute,
        solo: t.solo,
        fileId: t.storageFileId
      }));
  }

  // Notation Mapping
  if (raw.notationData && typeof raw.notationData === "object") {
    payload.notationData = raw.notationData;
  } else if (typeof (raw as any).sourceFileId === "string") {
    // Legacy migration for old MusicXML file IDs
    payload.notationData = {
      type: "music-xml",
      fileId: (raw as any).sourceFileId,
      timemap: [],
    };
  }

  return payload;
}


