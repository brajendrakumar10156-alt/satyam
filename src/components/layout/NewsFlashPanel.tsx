import React from 'react';
import { RefreshCw } from 'lucide-react';

interface NewsFlashPanelProps {
  showNewsPanel: boolean;
  setShowNewsPanel: React.Dispatch<React.SetStateAction<boolean>>;
  newsLoading: boolean;
  newsError: boolean | string | null;
  newsList: any[];
  setRightSidebar: (val: string) => void;
}

export const NewsFlashPanel: React.FC<NewsFlashPanelProps> = ({
  showNewsPanel,
  setShowNewsPanel,
  newsLoading,
  newsError,
  newsList,
  setRightSidebar
}) => {
  return (
    <div className="absolute bottom-[28px] right-14 z-40 flex flex-col items-end gap-1.5 pointer-events-none select-none">
      {/* News Popup Panel */}
      {showNewsPanel && (
        <div className="mb-1 w-[320px] bg-[#121626]/90 backdrop-blur-md border border-[#ea39ff]/40 rounded-xl shadow-[0_8px_32px_rgba(234,57,255,0.22)] overflow-hidden animate-fade-in pointer-events-auto origin-bottom-right">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ea39ff]/25">
            <div className="flex items-center gap-2">
              <span className="text-[#ea39ff] text-[13px]">⚡</span>
              <span className="text-white font-extrabold text-[12px] tracking-wide">Latest updates</span>
            </div>
            <button
              onClick={() => setShowNewsPanel(false)}
              className="text-gray-500 hover:text-white transition-colors text-[11px] font-black p-0.5"
            >
              ✕
            </button>
          </div>

          {/* News List */}
          <div className="max-h-[280px] overflow-y-auto dark-scrollbar">
            {newsLoading ? (
              <div className="flex flex-col items-center py-6 gap-1.5 text-gray-500">
                <RefreshCw size={13} className="animate-spin text-[#ea39ff]" />
                <span className="text-[10px] font-bold">Loading news...</span>
              </div>
            ) : newsError || newsList.length === 0 ? (
              <div className="py-5 text-center text-[11px] text-gray-500">
                No news available right now
              </div>
            ) : (
              newsList.map((item, i) => {
                const timeAgo = item.time || '';
                return (
                  <a
                    key={item.id || i}
                    href={item.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-0.5 px-4 py-2.5 border-b border-[#ea39ff]/10 hover:bg-[#ea39ff]/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 text-[9.5px] text-gray-500 font-semibold">
                      <span>{timeAgo}</span>
                      <span>·</span>
                      <span className="text-[#ea39ff] opacity-80">{item.source}</span>
                    </div>
                    <p className="text-white text-[11px] font-semibold leading-snug group-hover:text-[#ea39ff] transition-colors line-clamp-2">
                      {item.title}
                    </p>
                  </a>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-center py-2 bg-[#ea39ff]/5 border-t border-[#ea39ff]/20 cursor-pointer hover:bg-[#ea39ff]/10 transition-colors"
            onClick={() => { setShowNewsPanel(false); setRightSidebar('news'); }}
          >
            <span className="text-[10.5px] font-extrabold text-[#ea39ff] hover:text-white transition-colors">
              More events →
            </span>
          </div>
        </div>
      )}

      {/* Lightning Button */}
      <button
        onClick={() => setShowNewsPanel(prev => !prev)}
        title="Latest News"
        className={`relative flex items-center justify-center w-[26px] h-[26px] rounded-full transition-all duration-200 shadow-lg border pointer-events-auto ${
          showNewsPanel
            ? 'bg-[#ea39ff] border-[#ea39ff] shadow-[0_0_14px_rgba(234,57,255,0.7)]'
            : 'bg-[#1e222d] border-[#ea39ff]/50 hover:bg-[#ea39ff]/10 hover:border-[#ea39ff] hover:shadow-[0_0_10px_rgba(234,57,255,0.4)]'
        }`}
      >
        <span
          className={`text-[12px] font-black leading-none transition-colors ${
            showNewsPanel ? 'text-white' : 'text-[#ea39ff]'
          }`}
        >
          ⚡
        </span>
        {/* 6K Badge equivalent when news is available */}
        {!showNewsPanel && newsList.length > 0 && (
          <span className="absolute -top-[4px] -right-[6px] flex items-center justify-center min-w-[16px] h-[14px] px-1 bg-[#ea39ff] text-[#1e222d] text-[8.5px] font-black rounded-full border border-[#1e222d] shadow-sm tracking-tighter">
            {newsList.length > 999 ? '1K+' : newsList.length}
          </span>
        )}
      </button>
    </div>
  );
};
