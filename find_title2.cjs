const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const ltIdx = code.indexOf('<LeftToolbar');
if (ltIdx !== -1) {
    const sCode = code.substring(ltIdx - 4000, ltIdx + 100);
    fs.writeFileSync('top_navbar_block.txt', sCode);
}
