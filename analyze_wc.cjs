const fs = require('fs');
const lines = fs.readFileSync('src/WebContainer.tsx', 'utf8').split('\n');

let currentBlock = '';
let currentStart = 0;
let blockLengths = [];
let depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/^(function|const|let)\s+\w+.*\{/) || line.match(/<[A-Z]\w+.*(>|\/>)/)) {
    if (depth === 0) {
      currentBlock = line.substring(0, 100);
      currentStart = i;
    }
  }
  depth += (line.match(/\{/g) || []).length;
  depth -= (line.match(/\}/g) || []).length;
  if (depth === 0 && currentBlock !== '') {
    blockLengths.push({ block: currentBlock, start: currentStart, length: i - currentStart });
    currentBlock = '';
  }
}

blockLengths.sort((a, b) => b.length - a.length);
console.log(blockLengths.slice(0, 20).map(b => ${b.length} lines:  (line )).join('\n'));
