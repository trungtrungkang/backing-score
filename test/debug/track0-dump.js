const fs = require("fs");
const { Midi } = require("@tonejs/midi");
const verovio = require("verovio");
const xmldom = require("@xmldom/xmldom");

verovio.module.onRuntimeInitialized = async () => {
    const tk = new verovio.toolkit();
    tk.setOptions({ scale: 40 });
    const xml = fs.readFileSync("public/samples/musicxml/Lời chúc phúc.musicxml", "utf8");
    
    const doc = new xmldom.DOMParser().parseFromString(xml, "text/xml");
    
    // Strip pedals
    const directions = doc.getElementsByTagName('direction');
    for (let i = directions.length - 1; i >= 0; i--) {
        const dir = directions[i];
        if (dir.getElementsByTagName('pedal').length > 0) {
            dir.parentNode.removeChild(dir);
        }
    }
    
    // Strip ties
    const ties = doc.getElementsByTagName('tie');
    for (let i = ties.length - 1; i >= 0; i--) {
        const tie = ties[i];
        tie.parentNode.removeChild(tie);
    }

    const cleanXml = new xmldom.XMLSerializer().serializeToString(doc);

    tk.loadData(cleanXml);
    const midi64 = tk.renderToMIDI();
    
    const midi = new Midi(Buffer.from(midi64, "base64"));
    console.log("Track 0 Notes:");
    if (midi.tracks[0]) {
        midi.tracks[0].notes.slice(0, 5).forEach((n, i) => {
            console.log(`Index ${i}: ${n.name} (MIDI ${n.midi}) at ${n.time}s`);
        });
    }
    
    console.log("Track 1 Notes:");
    if (midi.tracks[1]) {
        midi.tracks[1].notes.slice(0, 30).forEach((n, i) => {
            console.log(`Index ${i}: ${n.name} (MIDI ${n.midi}) at ${n.time}s (Tick ${n.ticks})`);
        });
    }
};
