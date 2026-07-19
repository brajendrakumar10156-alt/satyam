const fs = require('fs');
const path = require('path');

// 1. Update App.jsx
const appPath = path.join(__dirname, 'src_demo', 'App.jsx');
let appCode = fs.readFileSync(appPath, 'utf8');

if (!appCode.includes("import html2canvas")) {
  appCode = "import html2canvas from 'html2canvas';\n" + appCode;
}

const takeScreenshotRegex = /const takeRealScreenshot = \(\) => \{\n\s*if \(chartInstance\.current\) \{\n\s*const link = document\.createElement\('a'\); link\.download = `\$\{selectedCoin\}_Chart\.png`;\n\s*link\.href = chartInstance\.current\.takeScreenshot\(\)\.toDataURL\('image\/png'\); link\.click\(\);\n\s*showToast\("📸 Screenshot Downloaded!"\);\n\s*\}\n\s*\};/;

const newScreenshotFunc = `const takeRealScreenshot = async () => {
    if (chartContainerRef.current) {
      try {
        const canvas = await html2canvas(chartContainerRef.current, {
          backgroundColor: darkMode ? '#131722' : '#ffffff',
          useCORS: true,
          allowTaint: true,
          ignoreElements: (element) => element.classList.contains('no-screenshot')
        });
        const link = document.createElement('a');
        link.download = \`\${selectedCoin}_Chart.png\`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast("📸 Screenshot Downloaded!");
      } catch (err) {
        console.error("Screenshot failed:", err);
        showToast("❌ Screenshot Failed!");
      }
    } else if (chartInstance.current) {
      // Fallback
      const link = document.createElement('a'); link.download = \`\${selectedCoin}_Chart.png\`;
      link.href = chartInstance.current.takeScreenshot().toDataURL('image/png'); link.click();
      showToast("📸 Screenshot Downloaded!");
    }
  };`;

appCode = appCode.replace(takeScreenshotRegex, newScreenshotFunc);
fs.writeFileSync(appPath, appCode, 'utf8');
console.log("App.jsx screenshot logic patched!");

// 2. Update WebGLChartEngine.jsx
const enginePath = path.join(__dirname, 'src_demo', 'components', 'WebGLChartEngine.jsx');
let engineCode = fs.readFileSync(enginePath, 'utf8');

if (!engineCode.includes('preserveDrawingBuffer')) {
  engineCode = engineCode.replace(
    /preference:\s*'webgl',/,
    "preference:      'webgl',\n        preserveDrawingBuffer: true,"
  );
  fs.writeFileSync(enginePath, engineCode, 'utf8');
  console.log("WebGLChartEngine.jsx preserveDrawingBuffer added!");
}
