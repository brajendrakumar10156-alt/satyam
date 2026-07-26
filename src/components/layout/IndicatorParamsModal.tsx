import React from 'react';
import { INDICATOR_REGISTRY } from '../../indicatorsRegistry';

interface IndicatorParamsModalProps {
  editingModalTab: string;
  setEditingModalTab: (tab: string) => void;
  activeModal: any;
  tempIndicatorParams: Record<string, any>;
  setTempIndicatorParams: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  tempIndicatorColor: string;
  setTempIndicatorColor: (color: string) => void;
  tempIndicatorWidth: number;
  setTempIndicatorWidth: (width: number) => void;
  darkMode: boolean;
  closeModal: () => void;
  setVisualIndicators: React.Dispatch<React.SetStateAction<any[]>>;
  showToast: (msg: string) => void;
}

export const IndicatorParamsModal: React.FC<IndicatorParamsModalProps> = ({
  editingModalTab,
  setEditingModalTab,
  activeModal,
  tempIndicatorParams,
  setTempIndicatorParams,
  tempIndicatorColor,
  setTempIndicatorColor,
  tempIndicatorWidth,
  setTempIndicatorWidth,
  darkMode,
  closeModal,
  setVisualIndicators,
  showToast
}) => {
  return (
    <div className="space-y-4 text-[12px] font-sans text-white">
      {/* Modal Tabs Header */}
      <div className="flex border-b border-[#2a2e39]/80 pb-2 mb-4">
        <button
          onClick={() => setEditingModalTab('inputs')}
          className={`flex-1 pb-2 text-[13px] font-bold text-center border-b-2 transition-all ${
            editingModalTab === 'inputs' ? 'border-b-2 border-blue-500 text-blue-400' : 'border-transparent text-gray-450 hover:text-white'
          }`}
        >
          Inputs
        </button>
        <button
          onClick={() => setEditingModalTab('style')}
          className={`flex-1 pb-2 text-[13px] font-bold text-center border-b-2 transition-all ${
            editingModalTab === 'style' ? 'border-b-2 border-blue-500 text-blue-400' : 'border-transparent text-gray-450 hover:text-white'
          }`}
        >
          Style
        </button>
      </div>

      {editingModalTab === 'inputs' ? (
        <div className="space-y-4 py-2">
          {/* Parameter Schema fields */}
          {INDICATOR_REGISTRY[activeModal.indicator.type]?.paramSchema.length > 0 ? (
            INDICATOR_REGISTRY[activeModal.indicator.type].paramSchema.map(param => (
              <div key={param.key} className="flex items-center justify-between gap-4">
                <span className="text-[12px] text-gray-300 font-bold uppercase tracking-wider">{param.label}</span>
                <input
                  type="number"
                  step={param.step || 1}
                  value={tempIndicatorParams[param.key] ?? ''}
                  onChange={(e) => {
                    const val = param.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value);
                    if (!isNaN(val)) {
                      setTempIndicatorParams(prev => ({ ...prev, [param.key]: val }));
                    }
                  }}
                  className={`w-24 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-blue-500 text-right`}
                />
              </div>
            ))
          ) : (
            <div className="text-gray-400 text-center py-6">No parameters to configure for this indicator.</div>
          )}
        </div>
      ) : (
        <div className="space-y-4 py-2">
          {/* Color Option */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[12px] text-gray-300 font-bold uppercase tracking-wider">Line Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={tempIndicatorColor}
                onChange={(e) => setTempIndicatorColor(e.target.value)}
                className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
              />
              <input
                type="text"
                value={tempIndicatorColor}
                onChange={(e) => setTempIndicatorColor(e.target.value)}
                className={`w-20 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2.5 py-1 font-mono text-[11px] outline-none`}
              />
            </div>
          </div>

          {/* Thickness Option */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[12px] text-gray-300 font-bold uppercase tracking-wider">Line Thickness</span>
            <select
              value={tempIndicatorWidth}
              onChange={(e) => setTempIndicatorWidth(parseInt(e.target.value))}
              className={`w-24 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2.5 py-1 font-bold outline-none`}
            >
              <option value="1">1px (Thin)</option>
              <option value="2">2px (Normal)</option>
              <option value="3">3px (Thick)</option>
              <option value="4">4px (Extra Thick)</option>
            </select>
          </div>
        </div>
      )}

      {/* Actions buttons */}
      <div className="flex justify-end gap-2 border-t border-[#2a2e39]/50 pt-3.5 mt-4">
        <button 
          onClick={closeModal} 
          className="px-4 py-2 rounded bg-gray-800 text-gray-400 hover:text-white font-bold transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={() => {
            setVisualIndicators(prev => prev.map(ind => 
              ind.id === activeModal.indicator.id 
                ? { ...ind, params: tempIndicatorParams, color: tempIndicatorColor, lineWidth: tempIndicatorWidth } 
                : ind
            ));
            closeModal();
            showToast(`Saved settings for ${activeModal.indicator.name}`);
          }}
          className="px-4 py-2 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
        >
          Apply Settings
        </button>
      </div>
    </div>
  );
};
