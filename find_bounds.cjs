const fs = require('fs');
const code = fs.readFileSync('src/WebContainer.tsx', 'utf8');
const lines = code.split('\n');

let startLine = -1;
let endLine = -1;
let braceCount = 0;
let inEffect = false;

for (let i = 2191; i < lines.length; i++) {
    if (lines[i].includes('useEffect(() => {') && lines[i+1]?.includes('!chartRef.current')) {
        startLine = i;
        inEffect = true;
    }
    if (inEffect) {
        braceCount += (lines[i].match(/\{/g) || []).length;
        braceCount -= (lines[i].match(/\}/g) || []).length;
        if (braceCount === 0 && startLine !== i) {
            endLine = i;
            break;
        }
    }
}
console.log('Main useEffect bounds:', startLine + 1, 'to', endLine + 1);
