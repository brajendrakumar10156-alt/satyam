const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Import
if (!code.includes("import { RightSidebar }")) {
    code = code.replace(
        "import React,", 
        "import { RightSidebar } from './components/layout/RightSidebar';\nimport React,"
    );
}

// 2. Locate renderRightSidePanel block
const startText = "  const renderRightSidePanel = () => {";
const endText = "  const LeftToolbar = ({ horizontal = false }) => {";
const startIdx = code.indexOf(startText);
const endIdx = code.indexOf(endText);

if (startIdx !== -1 && endIdx !== -1) {
    const before = code.substring(0, startIdx);
    const after = code.substring(endIdx);
    
    code = before + "\n  /* renderRightSidePanel extracted to RightSidebar.tsx */\n\n" + after;
}

// 3. Replace {renderRightSidePanel()} with <RightSidebar />
const propsString = `
<RightSidebar 
  rightSidebar={rightSidebar} setRightSidebar={setRightSidebar} themeConfig={t} 
  OrderBookPanel={OrderBookPanel} livePrice={livePrice} selectedCoin={selectedCoin} 
  selectedCoinStats={selectedCoinStats} handleRemoveWatchlist={handleRemoveWatchlist}
  isWatchlistMode={isWatchlistMode} setIsWatchlistMode={setIsWatchlistMode}
  showToast={showToast} isFavorite={isFavorite} toggleFavorite={toggleFavorite}
  isConnected={isConnected} showVolume={showVolume} setShowVolume={setShowVolume}
  showPerformance={showPerformance} setShowPerformance={setShowPerformance}
  hideDrawings={hideDrawings} setHideDrawings={setHideDrawings} chartType={chartType}
  setChartType={setChartType} toggleIndicator={toggleIndicator} activeIndicators={activeIndicators}
  getBaseAsset={getBaseAsset} removeAlert={removeAlert} alerts={alerts}
  alertCondition={alertCondition} setAlertCondition={setAlertCondition}
  alertPrice={alertPrice} setAlertPrice={setAlertPrice} addPriceAlert={addPriceAlert}
  newsFilterType={newsFilterType} setNewsFilterType={setNewsFilterType}
  newsLoading={newsLoading} newsError={newsError} newsList={newsList}
  watchlist={watchlist} renderBountyPanel={renderBountyPanel} darkMode={darkMode}
/>`.trim();

code = code.replaceAll("{renderRightSidePanel()}", propsString);

fs.writeFileSync(file, code);
console.log("RightSidebar replaced successfully in App.tsx!");
