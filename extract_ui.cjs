const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const returnRegex = /  return \(/g;
let lastIndex = -1;
let match;
while ((match = returnRegex.exec(code)) !== null) {
  lastIndex = match.index;
}

if (lastIndex !== -1) {
  const uiBlock = code.substring(lastIndex, lastIndex + 5000);
  fs.writeFileSync('ui_block.txt', uiBlock);
  console.log('UI Block extracted to ui_block.txt');
} else {
  console.log('Could not find the final return statement.');
}
