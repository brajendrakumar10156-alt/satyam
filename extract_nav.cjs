const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const navStart = code.indexOf('        {/* ===== TOP NAVBAR (Extract Later) ===== */}');
const navEnd = code.indexOf('        {/* ===== MAIN CONTENT AREA ===== */}');

if (navStart !== -1 && navEnd !== -1) {
  const navCode = code.substring(navStart, navEnd);
  fs.writeFileSync('topnavbar_code.txt', navCode);
  console.log('TopNavbar block extracted to topnavbar_code.txt');
} else {
  console.log('Could not find TopNavbar boundaries.');
}
