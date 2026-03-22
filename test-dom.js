const fs = require('fs');
const { Midi } = require('@tonejs/midi');
const { JSDOM } = require('jsdom');

const xml = fs.readFileSync('/tmp/twinkle.xml', 'utf-8');
const dom = new JSDOM("");
const parser = new dom.window.DOMParser();
const baseXmlDoc = parser.parseFromString(xml, 'text/xml');

        const baseNotes = baseXmlDoc.getElementsByTagName('note');
        for (let i = 0; i < baseNotes.length; i++) {
          const noteNode = baseNotes[i];
          const restElements = noteNode.getElementsByTagName('rest');
          const hasRest = restElements.length > 0;
          if (hasRest) {
            const types = noteNode.getElementsByTagName('type');
            if (types.length > 0 && types[0].textContent === 'whole') {
              restElements[0].setAttribute("measure", "yes");
              noteNode.removeChild(types[0]);
            }
          }
        }

        const directions = baseXmlDoc.getElementsByTagName('direction');
        for (let i = directions.length - 1; i >= 0; i--) {
          const dir = directions[i];
          if (dir.getElementsByTagName('pedal').length > 0) {
             dir.parentNode?.removeChild(dir);
          }
        }
        
        const openTies = {};
        const baseMeasures = baseXmlDoc.getElementsByTagName('measure');
        for (let i = 0; i < baseMeasures.length; i++) {
            const measure = baseMeasures[i];
            const mNotes = measure.getElementsByTagName('note');
            for (let j = 0; j < mNotes.length; j++) {
                const note = mNotes[j];
                const pitch = note.getElementsByTagName('pitch')[0];
                if (!pitch) continue;
                
                const step = pitch.getElementsByTagName('step')[0]?.textContent || '';
                const alter = pitch.getElementsByTagName('alter')[0]?.textContent || '';
                const octave = pitch.getElementsByTagName('octave')[0]?.textContent || '';
                const key = `${step}${alter}${octave}`;
                
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

const serializer = new dom.window.XMLSerializer();
const safeSvgText = serializer.serializeToString(baseXmlDoc);

const verovio = require('verovio');
verovio.module.onRuntimeInitialized = () => {
  const tk = new verovio.toolkit();
  tk.loadData(safeSvgText);
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
