import sys

def main():
    with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')
        
    print(f"Original lines: {len(lines)}")
        
    # --- PINE EDITOR REPLACEMENT ---
    # Find start
    pine_start = -1
    for i, line in enumerate(lines):
        if "const renderEditorPanel = (className =" in line:
            pine_start = i
            break
            
    if pine_start == -1:
        print("PineEditor start not found")
        return
        
    # Find end
    depth = 0
    pine_end = -1
    for i in range(pine_start, len(lines)):
        for char in lines[i]:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
        if depth == 0 and lines[i].strip() == ');':
            pine_end = i
            break
            
    print(f"PineEditor: {pine_start} to {pine_end}")
    
    # --- BOTTOM PANEL REPLACEMENT ---
    # Find BottomPanel trigger (the hidden state check)
    bottom_start_str = 'className={`w-full ${t.bg} flex flex-col min-h-0 transition-all'
    bottom_div_start = -1
    for i in range(len(lines)):
        if bottom_start_str in lines[i]:
            for j in range(i, -1, -1):
                if '<div' in lines[j]:
                    bottom_div_start = j
                    break
            break
            
    # Hover div
    hover_div_start = -1
    for i in range(len(lines)):
        if 'className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"' in lines[i]:
            for j in range(i, -1, -1):
                if '{lowerBoxState' in lines[j]:
                    hover_div_start = j
                    break
            break
            
    print(f"BottomPanel Div start: {bottom_div_start}")
    print(f"Hover Div start: {hover_div_start}")
    
    if bottom_div_start == -1 or hover_div_start == -1:
        print("BottomPanel starts not found")
        return
        
    depth = 0
    bottom_end = -1
    for i in range(bottom_div_start, len(lines)):
        depth += lines[i].count('<div') - lines[i].count('</div')
        if depth == 0:
            bottom_end = i
            break
            
    print(f"BottomPanel: {bottom_div_start} to {bottom_end}")
    
    # Let's verify BottomPanel ends correctly before applying!
    if bottom_end == -1 or bottom_end < bottom_div_start:
        print("Could not find bottom end correctly")
        return
        
    # Generate new lines array
    pine_replacement = [
        "  const renderEditorPanel = (className = '', onClose = null) => (",
        "    <PineEditorPanel",
        "      className={className}",
        "      onClose={onClose}",
        "      darkMode={darkMode}",
        "      themeConfig={t}",
        "      scripts={scripts}",
        "      setScripts={setScripts}",
        "      activeScript={activeScript}",
        "      setActiveScript={setActiveScript}",
        "      editorContent={editorContent}",
        "      setEditorContent={setEditorContent}",
        "      compileStatus={compileStatus}",
        "      setCompileStatus={setCompileStatus}",
        "      isCompiling={isCompiling}",
        "      setIsCompiling={setIsCompiling}",
        "      compilerLogs={compilerLogs}",
        "      setCompilerLogs={setCompilerLogs}",
        "      monaco={monaco}",
        "      showAIScriptAssistant={showAIScriptAssistant}",
        "      setShowAIScriptAssistant={setShowAIScriptAssistant}",
        "      showStrategyTester={showStrategyTester}",
        "      setShowStrategyTester={setShowStrategyTester}",
        "    />",
        "  );"
    ]
    
    bottom_replacement = [
        "        {lowerBoxState === 'hidden' && (",
        "          <div ",
        "            className=\"absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer\"",
        "            onMouseEnter={() => setLowerBoxState('minimized')}",
        "            title=\"Hover to show Report Panel\"",
        "          />",
        "        )}",
        "",
        "        {lowerBoxState !== 'hidden' && (",
        "          <BottomPanel",
        "            darkMode={darkMode}",
        "            themeConfig={t}",
        "            lowerBoxState={lowerBoxState}",
        "            setLowerBoxState={setLowerBoxState}",
        "            activeTab={activeTab}",
        "            setActiveTab={setActiveTab}",
        "            isReportPinned={isReportPinned}",
        "            setIsReportPinned={setIsReportPinned}",
        "            getLowerBoxHeight={getLowerBoxHeight}",
        "            metrics={metrics}",
        "            strategy={strategy}",
        "            formatMoney={formatMoney}",
        "            formatNumber={formatNumber}",
        "            formatShortNumber={formatShortNumber}",
        "            equityChartData={equityChartData}",
        "            winRateChartData={winRateChartData}",
        "            profitDistribution={profitDistribution}",
        "            longShortData={longShortData}",
        "            isMobile={isMobile}",
        "            setShowPredictionReport={setShowPredictionReport}",
        "            downloadReportScreenshot={downloadReportScreenshot}",
        "            backendOfflineNotice={backendOfflineNotice}",
        "            balance={balance}",
        "            unrealizedPnl={unrealizedPnl}",
        "            positions={positions}",
        "            leverage={leverage}",
        "            selectedCoin={selectedCoin}",
        "            livePrice={livePrice}",
        "            marginMode={marginMode}",
        "            setMarginMode={setMarginMode}",
        "            setLeverage={setLeverage}",
        "            orderType={orderType}",
        "            setOrderType={setOrderType}",
        "            useTPSL={useTPSL}",
        "            orderLimitPrice={orderLimitPrice}",
        "            setOrderLimitPrice={setOrderLimitPrice}",
        "            orderQty={orderQty}",
        "            setOrderQty={setOrderQty}",
        "            getBaseAsset={getBaseAsset}",
        "            setUseTPSL={setUseTPSL}",
        "            tpPrice={tpPrice}",
        "            setTpPrice={setTpPrice}",
        "            slPrice={slPrice}",
        "            setSlPrice={setSlPrice}",
        "            postOnly={postOnly}",
        "            setPostOnly={setPostOnly}",
        "            reduceOnly={reduceOnly}",
        "            setReduceOnly={setReduceOnly}",
        "            cost={cost}",
        "            account={account}",
        "            timeInForce={timeInForce}",
        "            setTimeInForce={setTimeInForce}",
        "            trailingStop={trailingStop}",
        "            setTrailingStop={setTrailingStop}",
        "            trailingStopCallback={trailingStopCallback}",
        "            setTrailingStopCallback={setTrailingStopCallback}",
        "            tpType={tpType}",
        "            setTpType={setTpType}",
        "            slType={slType}",
        "            setSlType={setSlType}",
        "            tpLimitPrice={tpLimitPrice}",
        "            setTpLimitPrice={setTpLimitPrice}",
        "            slLimitPrice={slLimitPrice}",
        "            setSlLimitPrice={setSlLimitPrice}",
        "            tpActivationPrice={tpActivationPrice}",
        "            setTpActivationPrice={setTpActivationPrice}",
        "            slActivationPrice={slActivationPrice}",
        "            setSlActivationPrice={setSlActivationPrice}",
        "            advancedTPSL={advancedTPSL}",
        "            setAdvancedTPSL={setAdvancedTPSL}",
        "            activePositions={activePositions}",
        "            setActivePositions={setActivePositions}",
        "            orders={orders}",
        "            setOrders={setOrders}",
        "            cancelOrder={cancelOrder}",
        "            cancelAllOrders={cancelAllOrders}",
        "            closePosition={closePosition}",
        "            closeAllPositions={closeAllPositions}",
        "            closeAllOrders={closeAllOrders}",
        "            orderHistory={orderHistory}",
        "            setOrderHistory={setOrderHistory}",
        "            tradeHistory={tradeHistory}",
        "            setTradeHistory={setTradeHistory}",
        "            activeDrawings={activeDrawings}",
        "            setActiveDrawings={setActiveDrawings}",
        "            setShowStrategyTester={setShowStrategyTester}",
        "          />",
        "        )}"
    ]
    
    # We replace from back to front so indices don't shift!
    
    print("Replacing BottomPanel...")
    # Remove from hover_div_start to bottom_end
    del lines[hover_div_start:bottom_end+1]
    # Insert new
    lines = lines[:hover_div_start] + bottom_replacement + lines[hover_div_start:]
    
    print("Replacing PineEditorPanel...")
    del lines[pine_start:pine_end+1]
    lines = lines[:pine_start] + pine_replacement + lines[pine_start:]
    
    # Add imports at the top
    imports = [
        "import { PineEditorPanel } from './components/layout/PineEditorPanel';",
        "import { BottomPanel } from './components/layout/BottomPanel';"
    ]
    lines = imports + lines
    
    with open('src/WebContainer.tsx', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
        
    print(f"Final lines: {len(lines)}")

if __name__ == '__main__':
    main()
