const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const lines = code.split('\n');
let mainReturnIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].startsWith('  return (')) {
    mainReturnIdx = i;
    break;
  }
}

if (mainReturnIdx !== -1) {
  const block = lines.slice(mainReturnIdx, mainReturnIdx + 200).join('\n');
  fs.writeFileSync('main_return.txt', block);
  console.log('Main return block written to main_return.txt');
} else {
  console.log('Not found');
}
