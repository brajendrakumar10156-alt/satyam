import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Target, Activity, CheckCircle, XCircle } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

export default function PredictionReportModal({ history, onClose, darkMode }) {
  const t = {
    bg: darkMode ? 'bg-[#1e222d]' : 'bg-white',
    text: darkMode ? 'text-gray-200' : 'text-gray-800',
    muted: darkMode ? 'text-gray-400' : 'text-gray-500',
    border: darkMode ? 'border-[#2a2e39]' : 'border-gray-200',
    panelBg: darkMode ? 'bg-[#131722]' : 'bg-gray-50',
  };

  const { total, wins, losses, winRate, chartData, hasValidData } = useMemo(() => {
    const valid = history.filter(h => h.isHit !== null);
    const wins = valid.filter(h => h.isHit).length;
    const losses = valid.length - wins;
    const winRate = valid.length > 0 ? ((wins / valid.length) * 100).toFixed(1) : 0;

    // We want to map the sequence of prices
    const chartData = valid.map((h, i) => {
      return {
        name: new Date(h.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        realClose: h.realClose,
        predictedClose: h.predictedClose,
        isHit: h.isHit
      };
    });

    return { total: valid.length, wins, losses, winRate, chartData, hasValidData: valid.length > 0 };
  }, [history]);

  const validHistory = history.filter(h => h.isHit !== null).reverse();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-5xl max-h-[95vh] flex flex-col ${t.bg} ${t.text} rounded-xl shadow-2xl border ${t.border} overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${t.border}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Activity className="text-blue-500" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Prediction Strategy Report</h2>
              <p className={`text-xs ${t.muted}`}>Auto-Predict AI Analysis vs Real Market</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full hover:bg-gray-500/20 transition-colors`}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {!hasValidData ? (
            <div className="text-center py-20">
              <Target size={48} className="mx-auto text-gray-500/50 mb-4" />
              <h3 className="text-lg font-medium text-gray-400">No predictions verified yet</h3>
              <p className="text-sm text-gray-500">Enable "Predict Next" and wait for the candle to close to see data here.</p>
            </div>
          ) : (
            <>
              {/* Dual Charts Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Real Market Chart */}
                <div className={`${t.panelBg} border ${t.border} p-4 rounded-xl flex flex-col`}>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <TrendingUp size={16} className="text-green-500" />
                    Real Market
                  </h4>
                  <p className={`text-xs ${t.muted} mb-4`}>Actual closing prices</p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#2a2e39' : '#e5e7eb'} vertical={false} />
                        <XAxis dataKey="name" stroke={darkMode ? '#4b5563' : '#9ca3af'} tick={{fontSize: 10}} minTickGap={20} />
                        <YAxis domain={['auto', 'auto']} stroke={darkMode ? '#4b5563' : '#9ca3af'} tick={{fontSize: 10}} width={60} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: darkMode ? '#1e222d' : '#fff', borderColor: darkMode ? '#2a2e39' : '#e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#22c55e' }}
                          formatter={(value) => [value.toFixed(2), 'Real Close']}
                        />
                        <Area type="monotone" dataKey="realClose" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorReal)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Predicted Market Chart */}
                <div className={`${t.panelBg} border ${t.border} p-4 rounded-xl flex flex-col`}>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Activity size={16} className="text-blue-500" />
                    Predicted Market
                  </h4>
                  <p className={`text-xs ${t.muted} mb-4`}>AI target prices</p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#2a2e39' : '#e5e7eb'} vertical={false} />
                        <XAxis dataKey="name" stroke={darkMode ? '#4b5563' : '#9ca3af'} tick={{fontSize: 10}} minTickGap={20} />
                        <YAxis domain={['auto', 'auto']} stroke={darkMode ? '#4b5563' : '#9ca3af'} tick={{fontSize: 10}} width={60} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: darkMode ? '#1e222d' : '#fff', borderColor: darkMode ? '#2a2e39' : '#e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#3b82f6' }}
                          formatter={(value) => [value.toFixed(2), 'Predicted Close']}
                        />
                        <Area type="stepAfter" dataKey="predictedClose" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPred)" isAnimationActive={false} strokeDasharray="4 4" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Stats & Win Rate */}
              <div className="grid grid-cols-3 gap-4">
                <div className={`${t.panelBg} border ${t.border} p-4 rounded-xl flex flex-col items-center justify-center`}>
                  <p className={`text-xs ${t.muted} uppercase tracking-wider mb-1`}>Total Trades</p>
                  <h3 className="text-2xl font-bold">{total}</h3>
                </div>
                <div className={`${t.panelBg} border ${t.border} p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden`}>
                  <div className={`absolute inset-0 opacity-10 ${winRate >= 50 ? 'bg-green-500' : 'bg-red-500'}`} />
                  <p className={`text-xs ${t.muted} uppercase tracking-wider mb-1 z-10`}>AI Win Rate</p>
                  <h3 className={`text-3xl font-black z-10 ${winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                    {winRate}%
                  </h3>
                </div>
                <div className={`${t.panelBg} border ${t.border} p-4 rounded-xl flex justify-around items-center`}>
                  <div className="text-center">
                    <p className={`text-xs ${t.muted} uppercase mb-1`}>Hits</p>
                    <p className="text-xl font-bold text-green-500">{wins}</p>
                  </div>
                  <div className="w-px h-10 bg-gray-500/20" />
                  <div className="text-center">
                    <p className={`text-xs ${t.muted} uppercase mb-1`}>Misses</p>
                    <p className="text-xl font-bold text-red-500">{losses}</p>
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className={`${t.panelBg} border ${t.border} rounded-xl overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${t.border} font-semibold flex items-center justify-between`}>
                  <span>Prediction Trade History</span>
                  <span className={`text-xs ${t.muted} font-normal`}>Last {validHistory.length} trades</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className={`text-xs uppercase ${darkMode ? 'bg-[#1a1e29] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Predicted Trend</th>
                        <th className="px-4 py-3">Real Trend</th>
                        <th className="px-4 py-3 text-right">Target Close</th>
                        <th className="px-4 py-3 text-right">Actual Close</th>
                        <th className="px-4 py-3 text-center">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validHistory.map((h, i) => (
                        <tr key={i} className={`border-b ${darkMode ? 'border-[#2a2e39] hover:bg-white/5' : 'border-gray-200 hover:bg-black/5'} transition-colors`}>
                          <td className="px-4 py-3 font-medium">{new Date(h.time * 1000).toLocaleTimeString()}</td>
                          <td className={`px-4 py-3 font-bold ${h.predictedUp ? 'text-green-500' : 'text-red-500'}`}>
                            {h.predictedUp ? 'UP' : 'DOWN'}
                          </td>
                          <td className={`px-4 py-3 font-bold ${h.realUp ? 'text-green-500' : 'text-red-500'}`}>
                            {h.realUp ? 'UP' : 'DOWN'}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-400/80 font-mono text-xs">
                            {h.predictedClose.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {h.realClose.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {h.isHit ? (
                              <div className="inline-flex items-center justify-center gap-1 bg-green-500/20 text-green-500 px-2 py-1 rounded-md text-xs font-bold min-w-[70px]">
                                <CheckCircle size={12} /> True
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center gap-1 bg-red-500/20 text-red-500 px-2 py-1 rounded-md text-xs font-bold min-w-[70px]">
                                <XCircle size={12} /> False
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
