const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const navStart = code.indexOf('<div className="flex items-center justify-between px-4 py-2 border-b'); // or similar
const titleIdx = code.indexOf('Titan Multi-Engine Chart');

if (titleIdx !== -1) {
    const sCode = code.substring(titleIdx - 2000, titleIdx + 3000);
    fs.writeFileSync('top_navbar_block.txt', sCode);
    console.log('TopNavbar block written to top_navbar_block.txt');
} else {
    // If not found, let's try finding LeftToolbar usage since I know it's there
    const ltIdx = code.indexOf('<LeftToolbar');
    if (ltIdx !== -1) {
        const ltCode = code.substring(ltIdx - 1500, ltIdx + 1500);
        fs.writeFileSync('top_navbar_block.txt', ltCode);
        console.log('LeftToolbar block written to top_navbar_block.txt');
    } else {
        console.log('Could not find LeftToolbar or Title');
    }
}
