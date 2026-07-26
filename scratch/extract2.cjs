const fs = require('fs');
const code = fs.readFileSync('src/WebContainer.tsx', 'utf8');
const lines = code.split('\n');

const startIdx = 4530;
const endIdx = 5195;

const extractedLines = lines.slice(startIdx, endIdx);

const bottomPanelCode = `import React, { useMemo } from 'react';
import { Activity, X, ChevronUp, ChevronDown, Check, Download, Layers, Crosshair, Pin, PinOff } from 'lucide-react';
import { ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, AreaChart, Legend } from 'recharts';
import { exportTradesCsv } from '../../tradingFeatures';

export const BottomPanel = ({
  darkMode,
  themeConfig: t,
  lowerBoxState,
  setLowerBoxState,
  activeTab,
  setActiveTab,
  isReportPinned,
  setIsReportPinned,
  getLowerBoxHeight,
  metrics,
  strategy,
  formatMoney,
  formatNumber,
  formatShortNumber,
  equityChartData,
  winRateChartData,
  profitDistribution,
  longShortData
}: any) => {
  if (lowerBoxState === 'hidden') return null;
  return (
${extractedLines.join('\n')}
  );
};
`;

fs.writeFileSync('src/components/layout/BottomPanel.tsx', bottomPanelCode);

const newWebContainerLines = [
  ...lines.slice(0, startIdx),
  `        <BottomPanel
          darkMode={darkMode}
          themeConfig={t}
          lowerBoxState={lowerBoxState}
          setLowerBoxState={setLowerBoxState}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isReportPinned={isReportPinned}
          setIsReportPinned={setIsReportPinned}
          getLowerBoxHeight={getLowerBoxHeight}
          metrics={metrics}
          strategy={strategy}
          formatMoney={formatMoney}
          formatNumber={formatNumber}
          formatShortNumber={formatShortNumber}
          equityChartData={equityChartData}
          winRateChartData={winRateChartData}
          profitDistribution={profitDistribution}
          longShortData={longShortData}
        />`,
  ...lines.slice(endIdx)
];

let newCode = newWebContainerLines.join('\n');
if (!newCode.includes("import { BottomPanel }")) {
  newCode = newCode.replace("import { ChartBottomBar }", "import { BottomPanel } from './components/layout/BottomPanel';\nimport { ChartBottomBar }");
}

fs.writeFileSync('src/WebContainer.tsx', newCode);
console.log('Successfully extracted BottomPanel. Removed', endIdx - startIdx, 'lines from WebContainer');
