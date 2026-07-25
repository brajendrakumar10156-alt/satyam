import React, { useState, useEffect } from 'react';

const AIRiskPanel = ({ symbol, currentPrice, latestIndicatorData }) => {
    const [analysis, setAnalysis] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const checkRisk = async () => {
        if (!symbol || !currentPrice || !latestIndicatorData) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/v1/ai/risk-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: symbol,
                    price: currentPrice,
                    indicator: latestIndicatorData.name || "SMA",
                    result: latestIndicatorData.value || 0.0
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            const data = await response.json();
            setAnalysis(data.analysis);
        } catch (err) {
            console.error("AI Risk Check failed:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            background: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            padding: '15px',
            marginTop: '15px',
            borderRadius: '8px',
            color: 'var(--text-primary)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2em' }}>🧠</span> Chief Risk Officer AI (Ollama)
                </h3>
                <button 
                    onClick={checkRisk} 
                    disabled={loading || !symbol}
                    className="action-btn"
                    style={{
                        padding: '5px 15px',
                        background: loading ? '#555' : 'var(--accent-primary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? "Analyzing..." : "Audit Trade"}
                </button>
            </div>

            <div style={{
                background: 'rgba(0,0,0,0.2)',
                padding: '10px',
                borderRadius: '4px',
                minHeight: '80px',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '0.9em',
                lineHeight: '1.4'
            }}>
                {loading ? (
                    <div style={{ color: 'var(--accent-secondary)', fontStyle: 'italic' }}>
                        Agent is checking math & market sentiment...
                    </div>
                ) : error ? (
                    <div style={{ color: '#ff4444' }}>Error: {error}</div>
                ) : analysis ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{analysis}</div>
                ) : (
                    <div style={{ color: '#888' }}>Click "Audit Trade" to run Ollama risk check.</div>
                )}
            </div>
        </div>
    );
};

export default AIRiskPanel;
