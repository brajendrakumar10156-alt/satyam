const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');
content = content.replace('await fetchCandles(selectedExchange, selectedCoin, chartInterval, 1000);', 'await fetchCandles(1000);');
fs.writeFileSync('src/WebContainer.tsx', content, 'utf8');
console.log('Fixed limit bug');
