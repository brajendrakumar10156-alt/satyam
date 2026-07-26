
const fs = require("fs");

function injectCanvas2D() {
    const path = "./src/WebContainer.tsx";
    let content = fs.readFileSync(path, "utf8");
    
    if (!content.includes("import Canvas2DChartEngine")) {
        const importStr = "import Canvas2DChartEngine from \"./components/Canvas2DChartEngine\";\n";
        content = content.replace(/(import React.*?;)/, "$1\n" + importStr);
    }
    
    const replacement = "<Canvas2DChartEngine candles={chartData} darkMode={darkMode} onCrosshairMove={handleCrosshairMove} />";
    // Using simple string replacement logic for safety
    content = content.split("<div ref={chartRef} className=\"w-full h-full absolute top-0 left-0\" />").join(replacement);
    
    fs.writeFileSync(path, content, "utf8");
    console.log("Successfully injected Canvas2DChartEngine into WebContainer.tsx");
}

injectCanvas2D();

