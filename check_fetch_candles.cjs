const fs = require('fs');
let lines = fs.readFileSync('src/WebContainer.tsx', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const fetchCandles = useCallback(async (limit = CANDLE_BATCH_SIZE) => {') || lines[i].includes('const fetchCandles =')) {
        for (let j = i; j < i + 30; j++) {
            console.log('Line ' + (j+1) + ': ' + lines[j].trim());
            if (lines[j].includes('}, [')) break;
        }
        break;
    }
}
