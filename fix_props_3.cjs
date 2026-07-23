const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldProps = `<RightSidebar 
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

const newProps = `<RightSidebar 
  rightSidebar={rightSidebar} setRightSidebar={setRightSidebar} themeConfig={t} 
  OrderBookPanel={OrderBookPanel} livePrice={livePrice} selectedCoin={selectedCoin} setSelectedCoin={setSelectedCoin}
  selectedCoinStats={selectedCoinStats} selectedExchange={selectedExchange} fearGreedIndex={fearGreedIndex}
  watchlist={watchlist} setWatchlist={setWatchlist} watchlistTickers={watchlistTickers}
  watchlistSearchInput={watchlistSearchInput} setWatchlistSearchInput={setWatchlistSearchInput}
  watchlistDropdownOpen={watchlistDropdownOpen} setWatchlistDropdownOpen={setWatchlistDropdownOpen}
  binanceCoins={binanceCoins} showToast={showToast} setMarketStatus={setMarketStatus}
  coinIconUrl={coinIconUrl} handleCoinIconError={handleCoinIconError}
  priceColor={priceColor} getBaseAsset={getBaseAsset} isPerpetualSymbol={isPerpetualSymbol}
  futuresLoading={futuresLoading} fundingRate={fundingRate} openInterest={openInterest}
  formatShortNumber={formatShortNumber} fundamentalsLoading={fundamentalsLoading}
  fundamentalsError={fundamentalsError} coinFundamentals={coinFundamentals}
  formatUSD={formatUSD} getFngColor={getFngColor}
/>`;

if (code.includes("formatCompactNumber={formatCompactNumber}")) {
  code = code.replaceAll(oldProps, newProps);
  fs.writeFileSync(file, code);
  console.log("Successfully replaced ALL occurrences in App.tsx!");
} else {
  console.log("Not found.");
}
