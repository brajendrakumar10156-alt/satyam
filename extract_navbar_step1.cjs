const fs = require('fs');

const appFile = 'src_demo/App.tsx';
let appCode = fs.readFileSync(appFile, 'utf8');

const rootFile = 'app_root.txt';
let rootCode = fs.readFileSync(rootFile, 'utf8');

// In app_root.txt, lines 145 to 712 roughly correspond to the Mobile and Desktop Header.
// Let's find the exact string to replace in App.tsx.
const lines = rootCode.split('\n');
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* MOBILE NEW TOP HEADER */}')) {
        startIndex = i;
    }
    if (lines[i].includes('{/* MOBILE HORIZONTAL TIMEFRAME SCROLLER (Hidden in new mobile design) */}')) {
        endIndex = i; // Up to here but not including it? No, wait. In app_root.txt, MOBILE HORIZONTAL TIMEFRAME SCROLLER is line 713
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    const chunkToExtract = lines.slice(startIndex, endIndex).join('\n');
    fs.writeFileSync('chunkToExtract.txt', chunkToExtract);
    console.log('Extracted chunk successfully.');
} else {
    console.log('Could not find boundaries.');
}
