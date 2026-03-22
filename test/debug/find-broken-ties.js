const fs = require('fs');
const xmldom = require('@xmldom/xmldom');

const xml = fs.readFileSync('public/samples/musicxml/Lời chúc phúc.musicxml', 'utf8');
const doc = new xmldom.DOMParser().parseFromString(xml, 'text/xml');

const measures = doc.getElementsByTagName('measure');
let openTies = {};

for (let i = 0; i < measures.length; i++) {
    const measure = measures[i];
    const measureNum = measure.getAttribute('number');
    
    const notes = measure.getElementsByTagName('note');
    for (let j = 0; j < notes.length; j++) {
        const note = notes[j];
        const pitch = note.getElementsByTagName('pitch')[0];
        if (!pitch) continue;
        
        const step = pitch.getElementsByTagName('step')[0]?.textContent || '';
        const alter = pitch.getElementsByTagName('alter')[0]?.textContent || '';
        const octave = pitch.getElementsByTagName('octave')[0]?.textContent || '';
        const key = `${step}${alter}${octave}`;
        
        const ties = note.getElementsByTagName('tie');
        for (let k = 0; k < ties.length; k++) {
            const tieType = ties[k].getAttribute('type');
            if (tieType === 'start') {
                openTies[key] = measureNum;
            } else if (tieType === 'stop') {
                if (openTies[key]) {
                    delete openTies[key];
                } else {
                    console.log(`[Warning] Stop tie WITHOUT a start tie in Measure ${measureNum} for ${key}`);
                }
            }
        }
    }
}

for (const [key, measureNum] of Object.entries(openTies)) {
    console.log(`[Fatal] Unclosed Tie started at Measure ${measureNum} for ${key}`);
}
