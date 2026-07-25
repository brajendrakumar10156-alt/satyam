const fs = require('fs');
const appPath = 'src_demo/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');

const statesToRemove = [
    /const \\[darkMode, setDarkMode\\] = useState[^\n]*\n/g,
    /const \\[stealthMode, setStealthMode\\] = useState[^\n]*\n/g,
    /const \\[focusMode, setFocusMode\\] = useState[^\n]*\n/g,
    /const \\[rightSidebar, setRightSidebar\\] = useState[^\n]*\n/g,
    /const \\[lowerBoxState, setLowerBoxState\\] = useState[^\n]*\n/g,
    /const \\[tradingTab, setTradingTab\\] = useState[^\n]*\n/g,
    /const \\[mobileMenuOpen, setMobileMenuOpen\\] = useState[^\n]*\n/g
];

let replaced = false;
statesToRemove.forEach(regex => {
    if (appContent.match(regex)) {
        appContent = appContent.replace(regex, '// migrated to uiStore\n');
        replaced = true;
    }
});

if (replaced) {
    const appStartIdx = appContent.indexOf('export default function App({');
    if (appStartIdx > -1) {
        const hookStr = '\n  const { darkMode, setDarkMode, stealthMode, setStealthMode, focusMode, setFocusMode, rightSidebar, setRightSidebar, lowerBoxState, setLowerBoxState, tradingTab, setTradingTab, isMobileMenuOpen, setMobileMenuOpen } = useUIStore();\n';
        appContent = appContent.substring(0, appStartIdx) + appContent.substring(appStartIdx).replace('{', '{' + hookStr);
        
        if (!appContent.includes('import { useUIStore }')) {
            appContent = 'import { useUIStore } from \'./store/uiStore\';\n' + appContent;
        }
        
        fs.writeFileSync(appPath, appContent);
        console.log('App.tsx updated successfully with useUIStore.');
    } else {
        console.log('Could not find App start.');
    }
} else {
    console.log('No useState hooks found to replace.');
}

