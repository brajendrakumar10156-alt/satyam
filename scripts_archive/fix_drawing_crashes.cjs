const fs = require('fs');

let app = fs.readFileSync('src/App.jsx', 'utf8');

// Fix handlePointerDown applyOptions
let hDownCrash = `chartInstance.current.applyOptions({ handleScroll: false, handleScale: false });`;
let hDownFix = `if (!useWebGL && chartInstance.current) { chartInstance.current.applyOptions({ handleScroll: false, handleScale: false }); }`;
app = app.replace(hDownCrash, hDownFix);

// Fix handlePointerUp applyOptions
let hUpCrash = `if (chartInstance.current) {
      chartInstance.current.applyOptions({ handleScroll: true, handleScale: true });
    }`;
let hUpFix = `if (!useWebGL && chartInstance.current) {
      chartInstance.current.applyOptions({ handleScroll: true, handleScale: true });
    }`;
app = app.replace(hUpCrash, hUpFix);

fs.writeFileSync('src/App.jsx', app);
console.log('Fixed WebGL drawing event crashes.');
