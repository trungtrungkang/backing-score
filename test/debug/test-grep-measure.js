const fs = require('fs');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const xml = fs.readFileSync('public/samples/musicxml/Lời chúc phúc.musicxml', 'utf8');
const doc = new DOMParser().parseFromString(xml, 'text/xml');
const parts = doc.getElementsByTagName('part');
for (let i = 0; i < parts.length; i++) {
    const partId = parts[i].getAttribute('id');
    const measures = parts[i].getElementsByTagName('measure');
    for (let j = 0; j < measures.length; j++) {
        if (measures[j].getAttribute('number') === '25') {
            console.log("--- PART " + partId + " MEASURE 25 ---");
            const str = new XMLSerializer().serializeToString(measures[j]);
            console.log(str);
        }
    }
}
