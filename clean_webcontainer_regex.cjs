const fs = require('fs');

const path = 'src/WebContainer.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /<div \s*className=\{`w-full \$\{t\.bg\} flex flex-col min-h-0 transition-all duration-300 \$\{lowerBoxState === 'hidden' \? '' : `border-t \$\{t\.border\} shadow-lg`\} z-10 \$\{getLowerBoxHeight\(\)\}`\}[\s\S]*?\{\/\* Strategy Tester and Trading Panel HTML was here \(Extracted to TradingPanel\.tsx\) \*\/}\s*<\/div>/g;

const match = code.match(regex);
if (match) {
  const actualTradingPanel = `<div 
          className={\`w-full \${t.bg} flex flex-col min-h-0 transition-all duration-300 \${lowerBoxState === 'hidden' ? '' : \`border-t \${t.border} shadow-lg\`} z-10 \${getLowerBoxHeight()}\`}
          onMouseLeave={() => { 
            if (!isReportPinned && lowerBoxState === 'minimized') {
              setLowerBoxState('hidden'); 
            }
          }}
        >
          <TradingPanel 
            positions={positions}
            paperOrders={paperOrders}
            selectedCoin={selectedCoin}
            livePrice={livePrice}
            leverage={leverage}
            closeActivePosition={closeActivePosition}
            cancelLimitOrder={cancelLimitOrder}
            handleExecuteArbitrage={handleExecuteArbitrage}
            t={t}
          />
        </div>`;
  
  code = code.replace(regex, actualTradingPanel);
  fs.writeFileSync(path, code);
  console.log("WebContainer.tsx updated successfully (TradingPanel replaced).");
} else {
  console.log("Still could not find TradingPanel block bounds");
}
