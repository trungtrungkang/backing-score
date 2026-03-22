const fs = require('fs');
const verovio = require('verovio');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

verovio.module.onRuntimeInitialized = () => {
    const toolkit = new verovio.toolkit();
    const xml = fs.readFileSync('public/samples/musicxml/Lời chúc phúc.musicxml', 'utf8');
    
    // Pedal Drop
    const parser = new DOMParser();
    const baseXmlDoc = parser.parseFromString(xml, 'text/xml');
    const directions = baseXmlDoc.getElementsByTagName('direction');
    for (let i = directions.length - 1; i >= 0; i--) {
        const dir = directions[i];
        if (dir.getElementsByTagName('pedal').length > 0) {
            dir.parentNode?.removeChild(dir);
        }
    }
    
    // Tie Fix
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
            const key = step+alter+octave;
            
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
    const safeSvgText = serializer.serializeToString(baseXmlDoc);
    const midiXmlDoc = parser.parseFromString(safeSvgText, 'text/xml');
    
    // Accidental Fix
    const midiNotes = midiXmlDoc.getElementsByTagName('note');
    for (let i = 0; i < midiNotes.length; i++) {
        const noteNode = midiNotes[i];
        const pitch = noteNode.getElementsByTagName('pitch')[0];
        const ExistingAccidental = noteNode.getElementsByTagName('accidental');
        if (pitch && ExistingAccidental.length === 0) {
            const alter = pitch.getElementsByTagName('alter')[0];
            let accType = 'natural';
            if (alter) {
               const val = alter.textContent;
               if (val === '-1') accType = 'flat';
               else if (val === '1') accType = 'sharp';
               else if (val === '-2') accType = 'flat-flat';
               else if (val === '2') accType = 'double-sharp';
            }
            const accNode = midiXmlDoc.createElement('accidental');
            accNode.textContent = accType;

            const timeMod = noteNode.getElementsByTagName('time-modification')[0];
            const stem = noteNode.getElementsByTagName('stem')[0];
            const notehead = noteNode.getElementsByTagName('notehead')[0];
            const noteheadText = noteNode.getElementsByTagName('notehead-text')[0];
            const staves = noteNode.getElementsByTagName('staff')[0];
            const beam = noteNode.getElementsByTagName('beam')[0];
            const notations = noteNode.getElementsByTagName('notations')[0];
            const lyric = noteNode.getElementsByTagName('lyric')[0];
            const play = noteNode.getElementsByTagName('play')[0];

            let anchor = timeMod || stem || notehead || noteheadText || staves || beam || notations || lyric || play || null;
            if (anchor) noteNode.insertBefore(accNode, anchor);
            else noteNode.appendChild(accNode);
        }
    }
    
    toolkit.loadData(serializer.serializeToString(midiXmlDoc));
    const midiStr = toolkit.renderToMIDI();
    
    const { Midi } = require('@tonejs/midi');
    const binaryString = Buffer.from(midiStr, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const m = new Midi(bytes);
    
    const MIDI_NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
    const toPitch = (midi) => MIDI_NOTES[midi % 12] + (Math.floor(midi / 12) - 1);
    
    console.log("Total Tracks:", m.tracks.length);
    m.tracks.forEach((t, i) => {
        const notesInMeasure25 = t.notes.filter(n => n.time > 40 && n.time < 50);
        console.log("--- Track " + i + " ---");
        notesInMeasure25.forEach(n => {
            const pitch = toPitch(n.midi);
            if (['G4', 'Eb3', 'G3', 'Bb3', 'Gb3', 'E2', 'Eb2'].includes(pitch)) {
                console.log("Time: " + n.time.toFixed(2) + " -> " + pitch);
            }
        });
    });
};
