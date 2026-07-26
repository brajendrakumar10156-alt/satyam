const fs = require('fs');
let lines = fs.readFileSync('src/WebContainer.tsx', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('CANDLE_BATCH_SIZE')) {
        console.log('Line ' + (i+1) + ': ' + lines[i].trim());
    }
}
