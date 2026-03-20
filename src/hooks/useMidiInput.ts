import { useState, useEffect } from 'react';

export function useMidiInput() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [hasMidiDevice, setHasMidiDevice] = useState(false);

  useEffect(() => {
    let activePitches = new Set<number>();
    
    const onMIDIMessage = (event: any) => {
      const db = event.data;
      if (!db || db.length < 3) return;
      
      const command = db[0] >> 4;
      const pitch = db[1];
      const velocity = db[2];
      
      if (command === 9 && velocity > 0) { // Note On
        activePitches.add(pitch);
      } else if (command === 8 || (command === 9 && velocity === 0)) { // Note Off
        activePitches.delete(pitch);
      }
      
      setActiveNotes(new Set(activePitches));
    };

    const setupMidi = async () => {
      try {
        if (navigator.requestMIDIAccess) {
          const midiAccess = await navigator.requestMIDIAccess();
          
          if (midiAccess.inputs.size > 0) {
             setHasMidiDevice(true);
          }
          
          midiAccess.inputs.forEach((input) => {
             input.onmidimessage = onMIDIMessage;
          });
          
          midiAccess.onstatechange = () => {
             setHasMidiDevice(midiAccess.inputs.size > 0);
             midiAccess.inputs.forEach(input => {
                input.onmidimessage = onMIDIMessage;
             });
          };
        }
      } catch (e) {
        console.warn('MIDI access denied or unsupported', e);
      }
    };

    setupMidi();

    return () => {
      activePitches = new Set();
    };
  }, []);

  return { activeNotes, hasMidiDevice };
}
