const fs = require('fs');
const verovio = require('verovio');

verovio.module.onRuntimeInitialized = () => {
    const toolkit = new verovio.toolkit();
    const xml = fs.readFileSync('public/samples/musicxml/Lời chúc phúc.musicxml', 'utf8');
    
    toolkit.setOptions({
        pageWidth: 800,
        pageHeight: 60000,
        scale: 40,
        breaks: "auto",
        adjustPageHeight: true 
    });
    
    toolkit.loadData(xml);
    const svg = toolkit.renderToSVG(1);
    
    const lines = svg.split('\n');
    let foundNotes = 0;
    for (const line of lines) {
        if (line.includes('class="note"')) {
            console.log(line);
            foundNotes++;
            if (foundNotes > 5) break; // just need a few examples!
        }
    }
};
