const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const ltIdx = code.indexOf('<LeftToolbar');
if (ltIdx !== -1) {
    let startIdx = code.lastIndexOf('return (', ltIdx);
    if (startIdx !== -1) {
        const block = code.substring(startIdx, ltIdx);
        fs.writeFileSync('app_root.txt', block);
        console.log('App root written to app_root.txt');
    }
} else {
    console.log('LeftToolbar not found');
}
