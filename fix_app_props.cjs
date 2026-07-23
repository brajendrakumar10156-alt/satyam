const fs = require('fs');

const missingProps = [
  'priceColor', 'replayMode', 'setReplayMode', 'fullCandlesRef', 'allCandlesRef',
  'setAllCandles', 'requestDraw', 'setFocusMode', 'setDarkMode'
];

const appPath = 'src_demo/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');

const navRegex = /<TopNavbar([^>]+)toggleFullscreen=\{toggleFullscreen\}([^>]*)\/>/s;
const match = appContent.match(navRegex);

if (match) {
    const newProps = missingProps.map(p => p + '={' + p + '}').join('\n              ');
    const newTag = '<TopNavbar' + match[1] + 'toggleFullscreen={toggleFullscreen}\n              ' + newProps + match[2] + '/>';
    
    fs.writeFileSync(appPath, appContent.replace(match[0], newTag));
    console.log('Updated App.tsx');
} else {
    console.log('Could not match TopNavbar tag in App.tsx');
}
