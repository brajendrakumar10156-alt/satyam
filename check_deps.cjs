const fs = require('fs');
let lines = fs.readFileSync('src/WebContainer.tsx', 'utf8').split('\n');
let i = 2104;
while(i < lines.length) {
    if (lines[i].includes('}, [')) {
        console.log('Line ' + (i+1) + ': ' + lines[i].trim());
        break;
    }
    i++;
}
