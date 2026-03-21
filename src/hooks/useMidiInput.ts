import { useState, useRef, useCallback } from 'react';

export function useMidiInput() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [hasMidiDevice, setHasMidiDevice] = useState(false);
  const [isMidiInitialized, setIsMidiInitialized] = useState(false);
  
  const activePitchesRef = useRef<Set<number>>(new Set());

  const initializeMidi = useCallback(async (): Promise<boolean> => {
    // Prevent redundant permission requests natively if already active
    if (isMidiInitialized) return true;

    try {
      if (navigator.requestMIDIAccess) {
        // This explicitly triggers the Browser UI Popup!
        const midiAccess = await navigator.requestMIDIAccess();
        
        setIsMidiInitialized(true);
        if (midiAccess.inputs.size > 0) {
           setHasMidiDevice(true);
        }
        
        const onMIDIMessage = (event: any) => {
          const db = event.data;
          if (!db || db.length < 3) return;
          
          const command = db[0] >> 4;
          const pitch = db[1];
          const velocity = db[2];
          
          if (command === 9 && velocity > 0) { // Note On
            activePitchesRef.current.add(pitch);
          } else if (command === 8 || (command === 9 && velocity === 0)) { // Note Off
            activePitchesRef.current.delete(pitch);
          }
          
          setActiveNotes(new Set(activePitchesRef.current));
        };

        midiAccess.inputs.forEach((input) => {
           input.onmidimessage = onMIDIMessage;
        });
        
        midiAccess.onstatechange = () => {
           setHasMidiDevice(midiAccess.inputs.size > 0);
           midiAccess.inputs.forEach(input => {
              input.onmidimessage = onMIDIMessage;
           });
        };
        return true;
      }
      return false;
    } catch (e) {
      console.warn('MIDI access denied or unsupported', e);
      return false;
    }
  }, [isMidiInitialized]);

  const disconnectMidi = useCallback(() => {
    activePitchesRef.current.clear();
    setActiveNotes(new Set());
    setIsMidiInitialized(false);
  }, []);

  return { activeNotes, hasMidiDevice, initializeMidi, isMidiInitialized, disconnectMidi };
}
