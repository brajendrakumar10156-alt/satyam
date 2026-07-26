import React from 'react';
import { History, Play, Minus, ArrowRight, X } from 'lucide-react';

export const BarReplayControls = ({
  replayMode,
  fullCandlesLength,
  isReplayPlaying,
  setIsReplayPlaying,
  setReplayIndex,
  replayIndex,
  replaySpeed,
  setReplaySpeed,
  allCandlesRef,
  fullCandlesRef,
  setAllCandles,
  setReplayMode,
  showToast
}: any) => {
  if (!replayMode || fullCandlesLength <= 1) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-[#1e222d]/95 border border-[#2a2e39] rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-2xl animate-fade-in text-white min-w-[340px] md:min-w-[480px]">
      {/* Title Badge */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
        <History size={11} />
        <span>Replay</span>
      </div>

      {/* Play / Pause */}
      <button
        onClick={() => setIsReplayPlaying(!isReplayPlaying)}
        className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer shrink-0"
        title={isReplayPlaying ? "Pause Playback" : "Start Playback"}
      >
        {isReplayPlaying ? <Minus size={14} className="rotate-90" /> : <Play size={14} />}
      </button>

      {/* Step Forward */}
      <button
        onClick={() => {
          setIsReplayPlaying(false);
          setReplayIndex((prev: number | null) => {
            if (prev === null) return 0;
            if (prev >= fullCandlesLength - 1) return prev;
            return prev + 1;
          });
        }}
        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors cursor-pointer shrink-0"
        title="Step Forward (1 Bar)"
      >
        <ArrowRight size={14} />
      </button>

      {/* Progress Range Slider */}
      <input
        type="range"
        min={10}
        max={fullCandlesLength - 1}
        value={replayIndex ?? fullCandlesLength - 1}
        onChange={(e) => {
          setIsReplayPlaying(false);
          setReplayIndex(Number(e.target.value));
        }}
        className="flex-1 accent-blue-500 h-1.5 rounded-lg bg-gray-700 appearance-none cursor-pointer"
      />

      {/* Frame index text */}
      <span className="text-[10px] font-mono text-gray-400 shrink-0">
        {replayIndex ?? 0}/{fullCandlesLength}
      </span>

      {/* Speed Selector */}
      <select
        value={replaySpeed}
        onChange={(e) => setReplaySpeed(Number(e.target.value))}
        className="bg-[#131722] border border-[#2a2e39] text-white text-[10px] font-bold rounded px-1.5 py-1 outline-none cursor-pointer shrink-0"
        title="Playback Speed"
      >
        <option value="2000">0.5s / bar</option>
        <option value="1000">1.0s / bar</option>
        <option value="500">2.0s / bar</option>
        <option value="200">5.0s / bar</option>
      </select>

      {/* Close / Exit Replay */}
      <button
        onClick={() => {
          setIsReplayPlaying(false);
          if (fullCandlesRef.current.length) {
            allCandlesRef.current = [...fullCandlesRef.current];
            setAllCandles([...fullCandlesRef.current]);
          }
          setReplayMode(false);
          showToast('▶️ Replay off');
        }}
        className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors cursor-pointer shrink-0 ml-1"
        title="Exit Replay"
      >
        <X size={14} />
      </button>
    </div>
  );
};
