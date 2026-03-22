const fs = require('fs');
const verovio = require('verovio');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

verovio.module.onRuntimeInitialized = () => {
    const toolkit = new verovio.toolkit();
    const xml = fs.readFileSync('public/samples/musicxml/Lời chúc phúc.musicxml', 'utf8');
    
    // Exact logic from MusicXMLVisualizer.tsx
    const parser = new DOMParser();
    const baseXmlDoc = parser.parseFromString(xml, 'text/xml');
    
    const directions = baseXmlDoc.getElementsByTagName('direction');
    for (let i = directions.length - 1; i >= 0; i--) {
      const dir = directions[i];
      if (dir.getElementsByTagName('pedal').length > 0) {
         dir.parentNode?.removeChild(dir);
      }
    }
    
    const openTies = {};
    const midiMeasures = baseXmlDoc.getElementsByTagName('measure');
    for (let i = 0; i < midiMeasures.length; i++) {
        const measure = midiMeasures[i];
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
                        openTies[key].pop();
                    } else {
                        tie.parentNode?.removeChild(tie);
                    }
                }
            }
        }
    }
    
    for (const key of Object.keys(openTies)) {
        for (const tie of openTies[key]) {
            tie.parentNode?.removeChild(tie);
        }
    }
    
    const serializer = new XMLSerializer();
    const safeMidiText = serializer.serializeToString(baseXmlDoc);
    
    toolkit.loadData(safeMidiText);
    const midiStr = toolkit.renderToMIDI();
    
    // Check output length by decoding the base64 or checking warnings
    console.log("MIDI rendered successfully.");
    
    // Decode MIDI using tonejs/midi to read duration
    const { Midi } = require('@tonejs/midi');
    const binaryString = Buffer.from(midiStr, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const m = new Midi(bytes);
    
    console.log("Total MIDI Tracks:", m.tracks.length);
    let max = 0;
    m.tracks.forEach((t, i) => {
        let tMax = 0;
        t.notes.forEach(n => {
            if (n.time + n.duration > tMax) tMax = n.time + n.duration;
        });
        console.log(`Track ${i} max duration:`, tMax, "seconds");
        if (tMax > max) max = tMax;
    });
    console.log("Global Max Duration:", max, "seconds");
};
