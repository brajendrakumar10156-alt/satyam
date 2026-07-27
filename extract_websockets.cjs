const fs = require('fs');
let code = fs.readFileSync('src/WebContainer.tsx', 'utf8');

const wsStart = code.indexOf('let disposed = false;');
if (wsStart !== -1) {
    const useEffectStart = code.lastIndexOf('useEffect(() => {', wsStart);
    let brace = 0;
    let wsEnd = -1;
    for (let i = useEffectStart; i < code.length; i++) {
        if (code[i] === '{') brace++;
        if (code[i] === '}') {
            brace--;
            if (brace === 0) {
                wsEnd = code.indexOf(';', i) + 1;
                if (wsEnd === 0 || wsEnd - i > 10) wsEnd = i + 1;
                break;
            }
        }
    }
    if (wsEnd !== -1 && wsEnd > useEffectStart) {
        const wsCode = code.substring(useEffectStart, wsEnd);
        fs.writeFileSync('src/hooks/useMarketWebsockets.ts', 
            `import { useEffect, useRef } from 'react';\n\nexport const useMarketWebsockets = (props: any) => {\n  const { selectedCoin, selectedExchange, fetchGenerationRef, handleRawTrade, upsertLiveCandle, setMarketStatus, chartInterval, isBacktesting, backendOnline } = props;\n\n${wsCode}\n};\n`
        );
        code = code.substring(0, useEffectStart) + '\n  useMarketWebsockets({ selectedCoin, selectedExchange, fetchGenerationRef, handleRawTrade, upsertLiveCandle, setMarketStatus, chartInterval, isBacktesting, backendOnline });\n' + code.substring(wsEnd);
        fs.writeFileSync('src/WebContainer.tsx', code);
        console.log('Extracted Websockets logic');
    }
}
