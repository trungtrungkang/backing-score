const fs = require('fs');
const verovio = require('verovio');

verovio.module.onRuntimeInitialized = () => {
    const toolkit = new verovio.toolkit();
    const xml = fs.readFileSync('public/samples/musicxml/Lời chúc phúc.musicxml', 'utf8');
    
    toolkit.loadData(xml);
    const midiStr = toolkit.renderToMIDI();
    
    const { Midi } = require('@tonejs/midi');
    const binaryString = Buffer.from(midiStr, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const m = new Midi(bytes);
    
    console.log("Total Tracks:", m.tracks.length);
    m.tracks.forEach((t, i) => {
        console.log("Track " + i + " Name: '" + t.name + "'");
    });
};
