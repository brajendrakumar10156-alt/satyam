const fs = require('fs');
let lines = fs.readFileSync('src/exchanges.ts', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export const fetchExchangeCandles')) {
        console.log('Line ' + (i+1) + ': ' + lines[i].trim());
        break;
    }
}
