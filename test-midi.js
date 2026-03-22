const fs = require('fs');
const { execSync } = require('child_process');
const { Midi } = require('@tonejs/midi');

execSync('unzip -p /Users/jefftrung/projects/paperclip/lotusa/projects/backing-and-score/public/samples/musicxml/twinkle-twinkle-little-star.mxl > /tmp/twinkle.xml');
const xml = fs.readFileSync('/tmp/twinkle.xml', 'utf-8');

const verovio = require('verovio');
verovio.module.onRuntimeInitialized = () => {
  const tk = new verovio.toolkit();
  tk.loadData(xml);
  const midiBase64 = tk.renderToMIDI();
  
  const binaryString = Buffer.from(midiBase64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  
  const midi = new Midi(bytes);
  
  let minMs = Infinity;
  let maxMs = 0;
  midi.tracks.forEach((t, index) => {
    let tMax = 0;
    t.notes.forEach(n => {
      if (n.time * 1000 < minMs) minMs = n.time * 1000;
      if ((n.time + n.duration) * 1000 > maxMs) maxMs = (n.time + n.duration) * 1000;
      if ((n.time + n.duration) * 1000 > tMax) tMax = (n.time + n.duration) * 1000;
    });
    console.log(`Track ${index} length: ${tMax} ms`);
  });
  console.log('Total maxMs:', maxMs);
};
