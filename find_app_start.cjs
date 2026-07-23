const fs = require('fs');
const appContent = fs.readFileSync('src_demo/App.tsx', 'utf8');

const match = appContent.match(/export default function App\s*\(\)\s*\{([\s\S]*?)const/i);
if (match) {
    console.log("Found App start.");
} else {
    // Try finding App component
    const match2 = appContent.match(/export default function App[\s\S]*?\{/);
    if (match2) {
        console.log("Found: " + match2[0]);
    } else {
        console.log("App not found.");
    }
}
