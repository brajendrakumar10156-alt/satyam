const fs = require('fs');

const missingProps = [
  'priceColor', 'replayMode', 'setReplayMode', 'fullCandlesRef', 'allCandlesRef',
  'setAllCandles', 'requestDraw', 'setFocusMode', 'setDarkMode'
];

// Update TopNavbar.tsx
const topNavPath = 'src_demo/components/layout/TopNavbar.tsx';
let topNavContent = fs.readFileSync(topNavPath, 'utf8');

const insertPoint = topNavContent.indexOf('toggleFullscreen\n') > -1 ? topNavContent.indexOf('toggleFullscreen\n') + 16 : topNavContent.indexOf('toggleFullscreen\r\n') + 18;

if (insertPoint > 20) {
    const updatedNav = topNavContent.substring(0, insertPoint) + ',\n    ' + missingProps.join(',\n    ') + topNavContent.substring(insertPoint);
    fs.writeFileSync(topNavPath, updatedNav);
    console.log('Updated TopNavbar.tsx');
}

// Update App.tsx
const appPath = 'src_demo/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');

const navRegex = /<TopNavbar([^>]+)toggleFullscreen=\{toggleFullscreen\}([^>]*)\/>/s;
const match = appContent.match(navRegex);

if (match) {
    const newProps = missingProps.map(p => p + '={' + p + '}').join('\n              ');
    const newTag = <TopNavbartoggleFullscreen={toggleFullscreen}\n              />;
    
    fs.writeFileSync(appPath, appContent.replace(match[0], newTag));
    console.log('Updated App.tsx');
} else {
    console.log('Could not match TopNavbar tag in App.tsx');
}

