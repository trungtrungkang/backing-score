const fs = require("fs");
const verovio = require("verovio");
const xmldom = require("@xmldom/xmldom");

verovio.module.onRuntimeInitialized = async () => {
    const tk = new verovio.toolkit();
    tk.setOptions({ scale: 40 });
    const xml = fs.readFileSync("public/samples/musicxml/Lời chúc phúc.musicxml", "utf8");
    tk.loadData(xml);
    const svg = tk.renderToSVG(1);
    fs.writeFileSync("test-svg.svg", svg);
    console.log("Wrote test-svg.svg");
};
