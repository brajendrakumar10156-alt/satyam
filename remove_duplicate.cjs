const fs = require('fs');
let lines = fs.readFileSync('src/WebContainer.tsx', 'utf8').split('\n');

// Delete main createChart (2192 to 2336)
// Wait, I need to find it dynamically to be safe.
let inEffect = false;
let startMain = -1, endMain = -1;
let braceCount = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useEffect(() => {') && lines[i+1]?.includes('!chartRef.current')) {
        startMain = i;
        inEffect = true;
    }
    if (inEffect) {
        braceCount += (lines[i].match(/\{/g) || []).length;
        braceCount -= (lines[i].match(/\}/g) || []).length;
        if (braceCount === 0 && startMain !== i) {
            endMain = i;
            break;
        }
    }
}

if (startMain !== -1 && endMain !== -1) {
    // Replace with empty lines to preserve line numbers for now, or just delete.
    // Deleting them.
    lines.splice(startMain, endMain - startMain + 1);
    console.log(Deleted main createChart from line  to );
}

fs.writeFileSync('src/WebContainer.tsx', lines.join('\n'), 'utf8');
