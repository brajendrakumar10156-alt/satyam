const fs = require('fs');
const appContent = fs.readFileSync('src_demo/App.tsx', 'utf8');
const lines = appContent.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('1D') && lines[i].includes('5D') && lines[i].includes('YTD') && lines[i].includes('button')) {
        console.log(Found time buttons around line );
        console.log(lines.slice(Math.max(0, i-5), i+15).join('\n'));
        break;
    }
}
