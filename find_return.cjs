const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const returns = code.split('  return (');
if (returns.length > 1) {
    const lastReturn = '  return (' + returns[returns.length - 1];
    fs.writeFileSync('last_return.txt', lastReturn.substring(0, 3000));
    console.log('Last return block written to last_return.txt');
} else {
    console.log('Could not split.');
}
