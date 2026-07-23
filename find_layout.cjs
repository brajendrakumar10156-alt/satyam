const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

// Find where the main App layout starts
const layoutIdx = code.indexOf('<div className={lex flex-col h-screen');
if (layoutIdx !== -1) {
    const layoutCode = code.substring(layoutIdx, layoutIdx + 3000);
    fs.writeFileSync('layout_block.txt', layoutCode);
    console.log('Layout block written to layout_block.txt');
} else {
    // try finding Top Navbar comment
    const commentIdx = code.indexOf('TOP NAVBAR');
    if (commentIdx !== -1) {
        const cCode = code.substring(commentIdx - 200, commentIdx + 3000);
        fs.writeFileSync('layout_block.txt', cCode);
        console.log('Found comment TOP NAVBAR, written to layout_block.txt');
    } else {
        // try just search coins
        const searchIdx = code.indexOf('Search coins');
        if (searchIdx !== -1) {
            const sCode = code.substring(searchIdx - 2000, searchIdx + 3000);
            fs.writeFileSync('layout_block.txt', sCode);
            console.log('Found Search coins, written to layout_block.txt');
        } else {
            console.log('Could not find anything.');
        }
    }
}
