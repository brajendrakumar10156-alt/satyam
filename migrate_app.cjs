const fs = require('fs');
const appPath = 'src_demo/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');
const lines = appContent.split('\n');

const toRemove = [
  "const [darkMode, setDarkMode]",
  "const [stealthMode, setStealthMode]",
  "const [focusMode, setFocusMode]",
  "const [activeTab, setActiveTab]",
  "const [lowerBoxState, setLowerBoxState]",
  "const [isReportPinned, setIsReportPinned]",
  "const [selectedIndicatorTab, setSelectedIndicatorTab]",
  "const [indicatorCategorySubTab, setIndicatorCategorySubTab]",
  "const [indicatorSearchQuery, setIndicatorSearchQuery]",
  "const [mobileMenuOpen, setMobileMenuOpen]",
  "const [activeModal, setActiveModal]",
  "const [rightSidebar, setRightSidebar]",
  "const [tradingTab, setTradingTab]"
];

let foundAny = false;

for (let i = 0; i < lines.length; i++) {
  if (toRemove.some(t => lines[i].includes(t) && lines[i].includes("useState"))) {
    lines[i] = "// migrated to useUIStore";
    foundAny = true;
  }
}

let newContent = lines.join('\n');

const appStart = newContent.indexOf("export default function App({");
if (appStart > -1 && foundAny) {
  const hookStr = "\n  const { darkMode, setDarkMode, stealthMode, setStealthMode, focusMode, setFocusMode, activeTab, setActiveTab, lowerBoxState, setLowerBoxState, isReportPinned, setIsReportPinned, selectedIndicatorTab, setSelectedIndicatorTab, indicatorCategorySubTab, setIndicatorCategorySubTab, indicatorSearchQuery, setIndicatorSearchQuery, isMobileMenuOpen: mobileMenuOpen, setMobileMenuOpen, activeModal, setActiveModal, rightSidebar, setRightSidebar, tradingTab, setTradingTab } = useUIStore();\n";
  newContent = newContent.substring(0, appStart) + newContent.substring(appStart).replace('{', '{' + hookStr);
  
  if (!newContent.includes("import { useUIStore }")) {
    newContent = "import { useUIStore } from './store/uiStore';\n" + newContent;
  }
  
  fs.writeFileSync(appPath, newContent);
  console.log("Successfully migrated states.");
} else {
  console.log("Could not find App start or no states found.");
}
