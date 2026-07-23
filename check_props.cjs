const fs = require('fs');
const content = fs.readFileSync('src_demo/components/layout/TopNavbar.tsx', 'utf8');

const knownProps = [
  'isMobile', 'focusMode', 'darkMode', 't', 'selectedCoin', 'livePrice', 
  'watchlistTickers', 'isDropdownOpen', 'setIsDropdownOpen', 'chartInterval', 
  'setChartInterval', 'chartStyle', 'setChartStyle', 'onBackToCoins', 
  'selectedExchange', 'handleExchangeChange', 'EXCHANGE_LIST', 'executeSearch', 
  'coinInput', 'setCoinInput', 'openModal', 'coinsLoading', 'filteredCoins', 
  'getQuoteAsset', 'fearGreedIndex', 'marketStatus', 'isTimeframeDropdownOpen', 
  'setIsTimeframeDropdownOpen', 'isStyleDropdownOpen', 'setIsStyleDropdownOpen', 
  'volumeProfile', 'setVolumeProfile', 'isActionsDropdownOpen', 'setIsActionsDropdownOpen', 
  'chartLayout', 'setChartLayout', 'isLayoutMenuOpen', 'setIsLayoutMenuOpen', 
  'isAutosave', 'setIsAutosave', 'isShareLayout', 'setIsShareLayout', 'layoutName', 
  'tradingTab', 'setTradingTab', 'lowerBoxState', 'setLowerBoxState', 'takeRealScreenshot', 
  'publishStrategy', 'stealthMode', 'setStealthMode', 'activeFlyout', 'setActiveFlyout', 
  'timezone', 'setTimezone', 'allCandles', 'timeframeButtons', 'customTimeframeInput', 
  'setCustomTimeframeInput', 'applyCustomTimeframe', 'loadDeepHistory', 'showToast', 
  'getFngColor', 'getExchangeMeta', 'setMobileMenuOpen', 'formatNumber', 'coinIconUrl', 'handleCoinIconError', 'setRightSidebar', 'toggleFullscreen'
];

const matches = content.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g);
const uniqueWords = [...new Set(matches)];

// Let's list some common React/JS globals to ignore
const globals = new Set([
  'React', 'const', 'let', 'var', 'if', 'else', 'return', 'true', 'false', 'null', 'undefined',
  'console', 'window', 'document', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Error', 'Promise',
  'localStorage', 'sessionStorage', 'navigator', 'location', 'fetch', 'FormData', 'URL', 'URLSearchParams',
  'props', 'e', 'prev', 'tz', 'coin', 'tf', 'style', 'ex', 'layout', 'priceColor', 'replayMode', 'setReplayMode', 'fullCandlesRef', 'allCandlesRef', 'setAllCandles', 'requestDraw',
  'Menu', 'ChevronDown', 'TrendingUp', 'Activity', 'ArrowLeft', 'Search', 'Scale', 'RefreshCw', 'ChevronDownIcon', 'Cloud', 'Info', 'Copy', 'Edit2', 'Download', 'Plus', 'Zap', 'FlaskConical', 'Settings', 'Camera', 'Upload', 'Maximize2', 'Focus', 'Ghost', 'Sun', 'Moon', 'Clock', 'Check', 'Database', 'History', 'CandlestickChart', 'BarChartHorizontal', 'LineChart', 'Bell', 'Rewind', 'LayoutGrid', 'TopNavbar', 'lucide'
]);

const missing = [];
for (const word of uniqueWords) {
    if (!knownProps.includes(word) && !globals.has(word)) {
        // filter out uppercase words which are likely html tags or standard things
        if (word.toUpperCase() === word && word.length > 2) continue; // like DIV, BUTTON, KBD, IMG, SPAN
        if (['div', 'button', 'span', 'img', 'input', 'kbd', 'select', 'option', 'form'].includes(word)) continue;
        if (['className', 'onClick', 'onChange', 'onMouseDown', 'onKeyDown', 'onSubmit', 'onFocus', 'onBlur', 'onError'].includes(word)) continue;
        if (['value', 'placeholder', 'autoComplete', 'type', 'id', 'src', 'alt', 'title', 'key', 'strokeWidth', 'dangerouslySetInnerHTML', '__html', 'style', 'color'].includes(word)) continue;
        if (['map', 'filter', 'includes', 'length', 'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'indexOf', 'join', 'split', 'replace', 'toLowerCase', 'toUpperCase'].includes(word)) continue;
        if (['target', 'key', 'preventDefault', 'setItem', 'getItem', 'toLocaleString', 'toFixed'].includes(word)) continue;
        if (['name', 'desc', 'icon', 'isPro', 'val', 'label', 'change', 'classification', 'minimumFractionDigits', 'maximumFractionDigits', 'width', 'height'].includes(word)) continue;
        if (word === 'react') continue;
        missing.push(word);
    }
}
console.log('Potentially missing props:', missing.join(', '));
