const fs = require('fs');
const verovio = require('verovio');
const { Midi } = require('@tonejs/midi');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const xmlRaw = fs.readFileSync('public/samples/musicxml/L\u1EDDi ch\u00FAc ph\u00FAc.musicxml', 'utf8');

const parser = new DOMParser();
const xmlDoc = parser.parseFromString(xmlRaw, 'text/xml');
const directions = xmlDoc.getElementsByTagName('direction');
for (let i = directions.length - 1; i >= 0; i--) {
  const dir = directions[i];
  if (dir.getElementsByTagName('pedal').length > 0) {
     dir.parentNode.removeChild(dir);
  }
}
const serializer = new XMLSerializer();
const safeXml = serializer.serializeToString(xmlDoc);

verovio.module.onRuntimeInitialized = () => {
  const tk = new verovio.toolkit();
  tk.loadData(safeXml);
  const base64Midi = tk.renderToMIDI();

  const binaryString = Buffer.from(base64Midi, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

  const midi = new Midi(bytes.buffer);
  midi.tracks.forEach((t, i) => {
     console.log(`Track ${i}: ${t.notes.length} notes`);
     if (t.notes.length > 0) {
        console.log(`  First: ${t.notes[0].time}s, Last: ${t.notes[t.notes.length-1].time}s`);
     }
  });
};
verovio.module.onRuntimeInitialized();
