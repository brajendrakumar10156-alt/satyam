const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');

content = content.replace(
  import RightSidebar from './components/layout/RightSidebar';,
  import RightSidebar from './components/layout/RightSidebar';\nimport TradingPanel from './components/layout/TradingPanel';
);

content = content.replace(
  /const \[tradingTab, setTradingTab\] = useState\('Positions'\);\s+/,
  ''
);

const panelStartStr = {/* Positions & Orders Main Area */};
const panelEndStr = {/* Unified Split Right Sidebar Container */};
const startIdx = content.indexOf(panelStartStr);
const endIdx = content.indexOf(panelEndStr);

if (startIdx !== -1 && endIdx !== -1) {
  // we want to replace from startIdx to just before endIdx - basically the whole <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e14]">
  // But wait, the outer container is <div className="h-64 md:h-72 border-t...">
  const divStart = content.lastIndexOf(<div className={\lex-1 flex flex-col min-w-0 bg-[#0b0e14]\}>, startIdx + 100);
  
  if (divStart !== -1) {
    // Find the matching closing div for divStart
    let depth = 0;
    let endIndex = -1;
    let i = divStart;
    
    while (i < content.length) {
      if (content.substring(i, i + 4) === '<div') { depth++; i += 4; }
      else if (content.substring(i, i + 5) === '</div') {
        depth--;
        i += 5;
        if (depth === 0) { endIndex = i + 1; break; }
      } else {
        i++;
      }
    }
    
    if (endIndex !== -1) {
      const replacement = <TradingPanel
                      positions={positions}
                      paperOrders={paperOrders}
                      selectedCoin={selectedCoin}
                      livePrice={livePrice}
                      leverage={leverage}
                      closeActivePosition={closeActivePosition}
                      cancelLimitOrder={cancelLimitOrder}
                      handleExecuteArbitrage={handleExecuteArbitrage}
                      t={t}
                    />;
      content = content.substring(0, divStart) + replacement + content.substring(endIndex);
    }
  }
}

// Remove tradingTab={tradingTab} from props passed to LeftSidebar/TopNav/Whatever (it was on line 4680)
content = content.replace(/\n\s*tradingTab=\{tradingTab\}\s*\n\s*setTradingTab=\{setTradingTab\}\s*\n/, '\n');

fs.writeFileSync('src/WebContainer.tsx', content, 'utf8');
