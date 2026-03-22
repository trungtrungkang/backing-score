const fs = require("fs");
const { Midi } = require("@tonejs/midi");
const verovio = require("verovio");

verovio.module.onRuntimeInitialized = async () => {
    const tk = new verovio.toolkit();
    tk.setOptions({ scale: 40 });
    const xml = fs.readFileSync("public/samples/musicxml/Lời chúc phúc.musicxml", "utf8");
    tk.loadData(xml);
    const midi64 = tk.renderToMIDI();
    
    const midi = new Midi(Buffer.from(midi64, "base64"));
    console.log("Global Tempos:");
    midi.header.tempos.forEach(t => console.log(t.ticks, "->", t.bpm, "BPM"));
};
