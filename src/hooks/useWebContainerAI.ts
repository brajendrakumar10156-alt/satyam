
export const useWebContainerAI = ({
  aiMode, editorMode, pineCode, pythonCode, setSyntaxStatus, showToast, 
  setActiveTab, aiChatHistory, setAiChatHistory, isAiTyping, setIsAiTyping, 
  aiInput, setAiInput
}: any) => {
  const sendAiMessage = async (mode = 'chat', overridePrompt = null) => {
    const prompt = (overridePrompt ?? aiPrompt).trim();
    if (!prompt && mode === 'chat') return;

    const provider = aiProvider;
    if (provider === 'gemini' && !aiKeysReady.gemini) {
      showToast('❌ Gemini API key missing in backend/.env');
      return;
    }
    if (provider === 'groq' && !aiKeysReady.groq) {
      showToast('❌ Groq API key missing in backend/.env');
      return;
    }

    setAiLoading(true);
    setSyntaxStatus('AI thinking...');
    setSubView('ai');
    setIsEditorOpen(true);

    const userLabel = prompt || { generate: 'Generate strategy', fix: 'Fix my code', explain: 'Explain strategy', optimize: 'Optimize strategy' }[mode] || 'AI request';
    appendAiMessage({ role: 'user', content: userLabel });

    try {
      const res = await fetch(`${API_BASE}/ai/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          prompt,
          mode,
          code: editorMode === 'pine' ? pineCode : pythonCode,
          language: editorMode,
          ticker: selectedCoin,
          timeframe: chartInterval,
          exchange: selectedExchange,
          context: {
            selectedCoin,
            exchange: selectedExchange,
            timeframe: chartInterval,
            editorMode,
            livePrice,
            marketStatus,
            priceColor,
            activeTab,
            backendOnline,
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      appendAiMessage({ role: 'assistant', content: data.reply, code: data.code });
      setAiPrompt('');
      setSyntaxStatus('AI ready.');
    } catch (e) {
      console.warn('Backend AI fallback to Client-Side AI Strategy Engine:', e);
      const clientGeneratedCode = aiStrategyEngine.generateFromPrompt(prompt || 'EMA crossover with RSI', editorMode);
      appendAiMessage({
        role: 'assistant',
        content: `⚡ **Client-Side AI Strategy Engine (Phase 5)**\n\nGenerated strategy for: "${prompt || 'EMA Crossover'}"`,
        code: clientGeneratedCode
      });
      setAiPrompt('');
      setSyntaxStatus('Client AI Ready.');
      showToast('⚡ Client AI Strategy Generated ✓');
    } finally {
      setAiLoading(false);
    }
  };

  return { sendAiMessage };
};
