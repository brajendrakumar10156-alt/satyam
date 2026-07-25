const fs = require('fs');
let content = fs.readFileSync('src_demo/components/WebGPUChartEngine.tsx', 'utf8');

// 1. JSX container background
content = content.replace(
  /className="w-full h-full relative bg-\[\#131722\] overflow-hidden cursor-crosshair"/g,
  'className={`w-full h-full relative ${darkMode ? "bg-[#131722]" : "bg-[#ffffff]"} overflow-hidden cursor-crosshair`}'
);

// 2. clearValue in render pass
content = content.replace(
  /clearValue: \{ r: 0\.051, g: 0\.067, b: 0\.090, a: 1\.0 \}, \/\/ \#0d1117 to match Canvas2D/g,
  'clearValue: darkMode ? { r: 0.051, g: 0.067, b: 0.090, a: 1.0 } : { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }, // Dynamic background'
);

// 3. grid shader function
content = content.replace('const wgslGridShader = `', 'const getWgslGridShader = (darkMode: boolean) => `');
content = content.replace(
  /vec4<f32>\(0\.051, 0\.067, 0\.090, 1\.0\); \/\/ Solid #0d1117 background/g,
  '${darkMode ? "vec4<f32>(0.051, 0.067, 0.090, 1.0)" : "vec4<f32>(1.0, 1.0, 1.0, 1.0)"}; // Dynamic background'
);

// 4. grid shader module creation
content = content.replace(
  /code: wgslGridShader/g,
  'code: getWgslGridShader(darkMode)'
);

// 5. error background
content = content.replace(
  /bg-\[\#131722\] text-sm/g,
  '${darkMode ? "bg-[#131722]" : "bg-[#ffffff]"} text-sm'
);

// 6. fix hover labels (WebGPUChartEngine line ~1800)
// They already use darkMode correctly inside backticks!

fs.writeFileSync('src_demo/components/WebGPUChartEngine.tsx', content);
