import React from 'react';

interface AlertSettingsModalProps {
  darkMode: boolean;
  selectedCoin: string;
  coinIconUrl: (coin: string) => string;
  handleCoinIconError: (e: any, coin: string) => void;
  alertCondition: string;
  setAlertCondition: (val: string) => void;
  alertPrice: string | number;
  setAlertPrice: (val: string) => void;
  livePrice: number;
  alertTrigger: string;
  setAlertTrigger: (val: string) => void;
  alertExpiration: string;
  setAlertExpiration: (val: string) => void;
  alertMessage: string;
  setAlertMessage: (val: string) => void;
  closeModal: () => void;
  addPriceAlert: () => void;
}

export const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({
  darkMode,
  selectedCoin,
  coinIconUrl,
  handleCoinIconError,
  alertCondition,
  setAlertCondition,
  alertPrice,
  setAlertPrice,
  livePrice,
  alertTrigger,
  setAlertTrigger,
  alertExpiration,
  setAlertExpiration,
  alertMessage,
  setAlertMessage,
  closeModal,
  addPriceAlert
}) => {
  return (
    <div className="space-y-4 text-[12px]">
      {/* Condition Ticker Dropdown */}
      <div>
        <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Condition</label>
        <div className="flex items-center gap-2">
          <div className={`flex-1 flex items-center gap-2 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-3 py-2 font-bold select-none`}>
            <img 
              src={coinIconUrl(selectedCoin)} 
              data-tier="0"
              onError={(e) => handleCoinIconError(e, selectedCoin)}
              alt="coin"
              className="w-4 h-4 rounded-full bg-white object-cover shrink-0" 
            />
            <span>{selectedCoin}</span>
          </div>
          
          <select 
            value={alertCondition} 
            onChange={(e) => setAlertCondition(e.target.value)}
            className={`flex-1 ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-2 font-semibold outline-none focus:border-blue-500`}
          >
            <option value="above">Crossing Up</option>
            <option value="below">Crossing Down</option>
          </select>
        </div>
      </div>

      {/* Price Level Crossing Value Input */}
      <div>
        <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Price Level</label>
        <input 
          type="number" 
          step="0.01"
          value={alertPrice}
          onChange={(e) => setAlertPrice(e.target.value)}
          placeholder={`Current: $${livePrice.toFixed(2)}`}
          className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-3 py-2 font-mono outline-none focus:border-blue-500`}
        />
      </div>

      {/* Expiration date time picker & trigger occurrence settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Trigger</label>
          <select 
            value={alertTrigger}
            onChange={(e) => setAlertTrigger(e.target.value)}
            className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-2 font-semibold outline-none focus:border-blue-500`}
          >
            <option value="Once only">Once only</option>
            <option value="Every time">Every time</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Expiration</label>
          <input 
            type="datetime-local" 
            value={alertExpiration}
            onChange={(e) => setAlertExpiration(e.target.value)}
            className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-2 py-2 font-semibold outline-none focus:border-blue-500 font-mono`}
          />
        </div>
      </div>

      {/* Alert Message Description */}
      <div>
        <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Message</label>
        <textarea 
          rows={3}
          value={alertMessage}
          onChange={(e) => setAlertMessage(e.target.value)}
          className={`w-full ${darkMode ? 'bg-[#1e222d] border-[#2a2e39] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded px-3 py-2 font-mono outline-none focus:border-blue-500 resize-none`}
        />
      </div>

      {/* Alert Notifications list */}
      <div>
        <label className="block text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Notifications</label>
        <div className="flex items-center gap-4 text-gray-300 font-semibold select-none pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" defaultChecked className="accent-[#7C5CFF]" />
            <span>In-App Toasts</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" defaultChecked className="accent-[#7C5CFF]" />
            <span>Show Popups</span>
          </label>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 border-t border-[#2a2e39]/50 pt-3 mt-4">
        <button 
          onClick={closeModal} 
          className="px-4 py-2 rounded bg-gray-800 text-gray-400 hover:text-white font-bold transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={() => {
            addPriceAlert();
            closeModal();
          }}
          className="px-4 py-2 rounded bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
        >
          Create Alert
        </button>
      </div>
    </div>
  );
};
