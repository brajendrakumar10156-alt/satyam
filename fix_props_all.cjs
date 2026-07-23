const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldProps = `<RightSidebar 
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
/>`;

const newProps = `<RightSidebar 
  rightSidebar={rightSidebar} setRightSidebar={setRightSidebar} themeConfig={t} 
  OrderBookPanel={OrderBookPanel} livePrice={livePrice} selectedCoin={selectedCoin} setSelectedCoin={setSelectedCoin}
  selectedCoinStats={selectedCoinStats} selectedExchange={selectedExchange} fearGreedIndex={fearGreedIndex}
  formatNumber={formatNumber} formatCompactNumber={formatCompactNumber}
  watchlist={watchlist} setWatchlist={setWatchlist} watchlistTickers={watchlistTickers}
  watchlistSearchInput={watchlistSearchInput} setWatchlistSearchInput={setWatchlistSearchInput}
  watchlistDropdownOpen={watchlistDropdownOpen} setWatchlistDropdownOpen={setWatchlistDropdownOpen}
  binanceCoins={binanceCoins} showToast={showToast} setMarketStatus={setMarketStatus}
  coinIconUrl={coinIconUrl} handleCoinIconError={handleCoinIconError}
/>`;

if (code.includes("handleRemoveWatchlist={handleRemoveWatchlist}")) {
  code = code.replaceAll(oldProps, newProps);
  fs.writeFileSync(file, code);
  console.log("Successfully replaced ALL occurrences!");
} else {
  console.log("Not found.");
}
