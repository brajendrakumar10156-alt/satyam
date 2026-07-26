const fs = require('fs');
let lines = fs.readFileSync('src/exchanges.ts', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
    if(lines[i].includes('export async function fetchExchangeCandles(')) {
        console.log(lines[i].trim());
    }
}
