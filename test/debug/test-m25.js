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
    
    const serializer = new XMLSerializer();
    const safeSvgText = serializer.serializeToString(baseXmlDoc);
    const midiXmlDoc = parser.parseFromString(safeSvgText, 'text/xml');
    
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
