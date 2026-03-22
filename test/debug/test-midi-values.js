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
    let testId = '';
    for (const line of lines) {
        if (line.includes('class="note"') && line.includes('id="')) {
            testId = line.split('id="')[1].split('"')[0];
            break;
        }
    }
    
    console.log("Testing ID:", testId);
    try {
        const midiValues = toolkit.getMIDIValuesForElement(testId);
        console.log("MIDI Values:", midiValues);
    } catch (e) {
        console.error("Method getMIDIValuesForElement failed:", e);
    }
};
