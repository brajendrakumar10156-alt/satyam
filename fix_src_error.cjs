const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

// The error is `ReferenceError: webGLEngineRef is not defined`
// We need to declare `const webGLEngineRef = useRef(null);` in the App component.
// We can insert it right after `const chartRef = useRef(null);`

if (!code.includes('const webGLEngineRef = useRef(null);')) {
  code = code.replace(
    /const chartRef = useRef\(null\);/,
    'const chartRef = useRef(null);\n  const webGLEngineRef = useRef(null);'
  );
  
  if (!code.includes('const useWebGL = false;')) {
    // If useWebGL is also not defined as state or variable, we better define it
    // Wait, let's check if useWebGL exists
    if (!code.includes('useWebGL')) {
        // It does exist, so we don't define it to avoid redeclaration, but wait, the grep failed earlier. Let's just define webGLEngineRef.
    }
  }

  fs.writeFileSync('src/App.jsx', code, 'utf8');
  console.log('Fixed webGLEngineRef error in src/App.jsx');
} else {
  console.log('webGLEngineRef is already defined.');
}
