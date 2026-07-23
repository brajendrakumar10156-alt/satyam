const fs = require('fs');

const chunk = fs.readFileSync('chunkToExtract.txt', 'utf8');
const appCode = fs.readFileSync('src_demo/App.tsx', 'utf8');

const propsList = [
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

let topNavbarComponent = "import React from 'react';\n" +
"import { Menu, ChevronDown, TrendingUp, Activity, ArrowLeft, Search, Scale, RefreshCw, ChevronDown as ChevronDownIcon, Cloud, Info, Copy, Edit2, Download, Plus, Zap, FlaskConical, Settings, Camera, Upload, Maximize2, Focus, Ghost, Sun, Moon, Clock, Check, Database, History, CandlestickChart, BarChartHorizontal, LineChart, Bell, Rewind, LayoutGrid } from 'lucide-react';\n\n" +
"export const TopNavbar = (props: any) => {\n" +
"  const {\n    " +
propsList.join(',\n    ') +
"\n  } = props;\n\n" +
"  return (\n    <>\n" +
chunk +
"\n    </>\n  );\n};\n";

fs.writeFileSync('src_demo/components/layout/TopNavbar.tsx', topNavbarComponent);

const propsString = propsList.map(p => p + '={' + p + '}').join('\n              ');
const replacement = "      <TopNavbar \n              " + propsString + "\n            />";

const startIdx = appCode.indexOf('{/* MOBILE NEW TOP HEADER */}');
const endIdx = appCode.indexOf('{/* MOBILE HORIZONTAL TIMEFRAME SCROLLER');

if (startIdx !== -1 && endIdx !== -1) {
    const exactChunk = appCode.substring(startIdx, endIdx);
    const updatedAppCode = appCode.replace(exactChunk, replacement + '\n      ');
    fs.writeFileSync('src_demo/App.tsx', updatedAppCode);
    console.log('Successfully replaced chunk in App.tsx using robust replace');
} else {
    console.log('Failed to find chunk in App.tsx');
}
