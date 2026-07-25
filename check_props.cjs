const fs = require('fs');
const appContent = fs.readFileSync('src_demo/App.tsx', 'utf8');

const navStart = appContent.indexOf('<TopNavbar');
const navEnd = appContent.indexOf('/>', navStart);
console.log('TopNavbar block:\\n' + appContent.substring(navStart, navEnd + 2));

const rightStart = appContent.indexOf('<RightSidebar');
if (rightStart > -1) {
  const rightEnd = appContent.indexOf('/>', rightStart);
  console.log('RightSidebar block:\\n' + appContent.substring(rightStart, rightEnd + 2));
}

const leftStart = appContent.indexOf('<LeftToolbar');
if (leftStart > -1) {
  const leftEnd = appContent.indexOf('/>', leftStart);
  console.log('LeftToolbar block:\\n' + appContent.substring(leftStart, leftEnd + 2));
}

