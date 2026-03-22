const fs = require("fs");
const { Midi } = require("@tonejs/midi");
const verovio = require("verovio");
const xmldom = require("@xmldom/xmldom");

verovio.module.onRuntimeInitialized = async () => {
    const tk = new verovio.toolkit();
    tk.setOptions({ scale: 40 });
    const xml = fs.readFileSync("public/samples/musicxml/Lời chúc phúc.musicxml", "utf8");
    
    // Clean pedal
    const doc = new xmldom.DOMParser().parseFromString(xml, "text/xml");
    const pedals = doc.getElementsByTagName('pedal');
    for (let i = pedals.length - 1; i >= 0; i--) {
        pedals[i].parentNode.removeChild(pedals[i]);
    }
    const cleanXml = new xmldom.XMLSerializer().serializeToString(doc);

    tk.loadData(cleanXml);
    const midi64 = tk.renderToMIDI();
    
    const midi = new Midi(Buffer.from(midi64, "base64"));
    console.log("TOTAL TRACKS:", midi.tracks.length);
    midi.tracks.forEach((t, i) => {
        if (t.notes.length > 0) {
            console.log(`Track ${i}: ${t.name || 'Unnamed'}, Notes: ${t.notes.length}, Channel: ${t.channel}`);
        }
    });
};
