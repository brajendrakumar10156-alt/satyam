const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');

// The large block starts around line 2192: useEffect(() => { if (!chartRef.current) return;
// And ends around line 2336.
// Let's replace the whole useEffect that creates the lightweight chart.
// To be safe, we will just comment out const chart = createChart and the entire useEffect.

let lines = content.split('\n');
let inChartEffect = false;
let braceCount = 0;
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useEffect(() => {') && lines[i+1] && lines[i+1].includes('if (!chartRef.current) return;')) {
        inChartEffect = true;
        startLine = i;
    }
    if (inChartEffect) {
        braceCount += (lines[i].match(/\{/g) || []).length;
        braceCount -= (lines[i].match(/\}/g) || []).length;
        if (braceCount === 0 && startLine !== i) {
            endLine = i;
            break;
        }
    }
}

if (startLine !== -1 && endLine !== -1) {
    for (let i = startLine; i <= endLine; i++) {
        lines[i] = '// ' + lines[i];
    }
    fs.writeFileSync('src/WebContainer.tsx', lines.join('\n'), 'utf8');
    console.log("Commented out lightweight-charts initialization from line " + (startLine + 1) + " to " + (endLine + 1));
} else {
    console.log("Could not find the chart initialization effect.");
}
