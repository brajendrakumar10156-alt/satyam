const fs = require('fs');
const appContent = fs.readFileSync('src_demo/App.tsx', 'utf8');
const lines = appContent.split('\n');
const targets = ['rightSidebar', 'lowerBoxState', 'tradingTab'];
for (let i = 200; i < 400; i++) {
    if (lines[i] && targets.some(t => lines[i].includes(t) && lines[i].includes('useState'))) {
        console.log(Line : );
    }
}

