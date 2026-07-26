const fs = require('fs');
let lines = fs.readFileSync('src/exchanges.ts', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export async function fetchRustCollector')) {
        for (let j = i; j < i + 10; j++) {
            console.log(lines[j].trim());
        }
        break;
    }
}
