const fs = require('fs');
const { Midi } = require('@tonejs/midi');
const verovio = require('verovio');

const xml = fs.readFileSync('/tmp/twinkle.xml', 'utf-8');
verovio.module.onRuntimeInitialized = () => {
  const tk = new verovio.toolkit();
  tk.loadData(xml);
  const midiBase64 = tk.renderToMIDI();
  
  const binaryString = Buffer.from(midiBase64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  
  const midi = new Midi(bytes);
  console.log("Header Time Sigs:", midi.header.timeSignatures);
  console.log("Header Tempos:", midi.header.tempos);
};
