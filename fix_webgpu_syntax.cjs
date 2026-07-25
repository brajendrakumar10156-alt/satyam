const fs = require('fs');
let content = fs.readFileSync('src_demo/components/WebGPUChartEngine.tsx', 'utf8');

const lines = content.split('\n');
const newLines = lines.map(line => {
  if (line.includes('WebGPU Error: {gpuError}</div>')) {
    return line.replace(
      'className="w-full h-full flex items-center justify-center text-red-500 ${darkMode ? "bg-[#131722]" : "bg-[#ffffff]"} text-sm font-medium p-4 text-center"',
      'className={`w-full h-full flex items-center justify-center text-red-500 ${darkMode ? "bg-[#131722]" : "bg-[#ffffff]"} text-sm font-medium p-4 text-center`}'
    );
  }
  return line;
});

fs.writeFileSync('src_demo/components/WebGPUChartEngine.tsx', newLines.join('\n'));
