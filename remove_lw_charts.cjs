const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');

// Count lines before
console.log('Before: ' + content.split('\n').length);

// 1. Remove createChart import
content = content.replace(/import \{ createChart \} from 'lightweight-charts';\n?/, '');

// 2. We can just use a regex to match from // Initialize and mount Lightweight Charts up to the end of that useEffect.
// Actually, it's safer to find useEffect(() => { that contains createChart.
const createChartEffectStr = useEffect(() => {\n    if (!chartRef.current || renderEngine !== 'canvas2d') return;;
let startIndex = content.indexOf(createChartEffectStr);
if (startIndex !== -1) {
  let depth = 0;
  let inEffect = false;
  let endIndex = -1;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') { depth++; inEffect = true; }
    else if (content[i] === '}') {
      depth--;
      if (inEffect && depth === 0) {
        // Find the ending );
        endIndex = content.indexOf(');', i) + 2;
        break;
      }
    }
  }
  if (endIndex !== -1) {
    content = content.substring(0, startIndex) + content.substring(endIndex);
    console.log('Removed createChart useEffect');
  }
}

// 3. Find useEffect for setting data
const setDataEffectStr = useEffect(() => {\n    if (!candleSeries.current || !allCandles.length) return;;
startIndex = content.indexOf(setDataEffectStr);
if (startIndex !== -1) {
  let depth = 0;
  let inEffect = false;
  let endIndex = -1;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') { depth++; inEffect = true; }
    else if (content[i] === '}') {
      depth--;
      if (inEffect && depth === 0) {
        endIndex = content.indexOf(');', i) + 2;
        break;
      }
    }
  }
  if (endIndex !== -1) {
    content = content.substring(0, startIndex) + content.substring(endIndex);
    console.log('Removed setData useEffect');
  }
}

fs.writeFileSync('src/WebContainer.tsx', content, 'utf8');
console.log('After: ' + content.split('\n').length);
