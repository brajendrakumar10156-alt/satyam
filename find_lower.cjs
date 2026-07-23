const fs = require('fs');
const appContent = fs.readFileSync('src_demo/App.tsx', 'utf8');

const startIdx = appContent.indexOf('{/* LOWER PANEL (Arbitrage Matrix / Strategy Tester) */}');
const endIdx = appContent.indexOf('{/* MOBILE NAVIGATION BAR */}');

if (startIdx !== -1 && endIdx !== -1) {
    console.log(Found lower panel. Size: );
    const chunk = appContent.substring(startIdx, endIdx);
    fs.writeFileSync('lower_panel_chunk.txt', chunk);
    console.log('Saved to lower_panel_chunk.txt');
} else {
    console.log('Could not find lower panel.');
}
