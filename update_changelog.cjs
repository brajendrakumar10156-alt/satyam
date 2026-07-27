const fs = require('fs');
const content = `
### 20:49:03 IST — \`src/WebContainer.tsx\`
- ACTION: MODIFY
- OLD: Massive inline HTML blocks for TradingPanel and EditorPanel
- NEW: Replaced with imported \`<TradingPanel>\` and \`<PineEditorPanel>\` components
- WHY: Removed duplicate/unused code to reduce file size and simplify architecture as requested.

### 20:49:03 IST — \`src/components/layout/LeftToolbar.tsx\`
- ACTION: MODIFY
- OLD: \`max-h-[calc(100vh-140px)]\`
- NEW: \`flex-1 min-h-0 min-w-0\`
- WHY: Fixed UI squishing issue on Tauri desktop by allowing flex container to adjust to window size.

### 20:49:03 IST — \`src/components/layout/TopNavbar.tsx\`
- ACTION: MODIFY
- OLD: \`overflow-x-auto whitespace-nowrap custom-scrollbar\`
- NEW: Removed those overflow classes.
- WHY: Prevent clipping of Absolute Positioned dropdowns (Search, Timeframe) when opened on desktop.

### 20:49:03 IST — \`package.json\`
- ACTION: MODIFY
- OLD: \`satyam-ai-terminal\`
- NEW: \`quanta-ai\`
- WHY: Updated project name as requested.

### 20:49:03 IST — \`tsconfig.json\`
- ACTION: MODIFY
- OLD: \`["src", "src_demo"]\`
- NEW: \`["src"]\`
- WHY: Removed obsolete src_demo reference.
`;

fs.appendFileSync('CHANGELOG.md', content);
