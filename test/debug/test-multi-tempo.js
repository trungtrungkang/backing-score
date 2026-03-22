const fs = require("fs");
const { Midi } = require("@tonejs/midi");
const verovio = require("verovio");
const xmldom = require("@xmldom/xmldom");

verovio.module.onRuntimeInitialized = async () => {
    const tk = new verovio.toolkit();
    tk.setOptions({ scale: 40 });
    const xml = fs.readFileSync("public/samples/musicxml/Lời chúc phúc.musicxml", "utf8");
    
    tk.loadData(xml);
    const midi64 = tk.renderToMIDI();
    
    const midi = new Midi(Buffer.from(midi64, "base64"));
    console.log("PPQ:", midi.header.ppq);
    const track1 = midi.tracks[1];
    
    // Log the 18th unique chord's tick instead of time!
    console.log("Track 1 ticks for Index 18:");
    console.log("Ticks:", track1.notes[28].ticks, "Time:", track1.notes[28].time); // Index 28 is C6
};
