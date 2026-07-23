import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const Canvas2DChartEngine = forwardRef(({
  candles,
  darkMode,
  chartInterval,
  timezoneOffset = 0,
  isMobile = false,
  onCrosshairMove
}, ref) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const candleSeries = useRef(null);
  const volumeSeries = useRef(null);
  const [chartCreated, setChartCreated] = useState(false);

  // Expose refs to the parent App.tsx
  useImperativeHandle(ref, () => ({
    get chartInstance() { return chartInstance.current; },
    get candleSeries() { return candleSeries.current; },
    get volumeSeries() { return volumeSeries.current; },
    get container() { return chartRef.current; }
  }));

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight || 300,
      layout: {
        background: { color: darkMode ? '#0d1117' : '#ffffff' },
        textColor: darkMode ? '#c9d1d9' : '#131722',
        fontSize: 11,
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
      },
      localization: {
        timeFormatter: (businessDayOrTimestamp) => {
          if (!businessDayOrTimestamp) return '';
          const d = new Date((businessDayOrTimestamp + timezoneOffset) * 1000);
          return `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })} '${d.getUTCFullYear().toString().substring(2)} ${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}`;
        }
      },
      watermark: {
        visible: false,
      },
      grid: {
        vertLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb', style: 1 },
        horzLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb', style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: darkMode ? 'rgba(180,190,210,0.4)' : 'rgba(100,110,130,0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: darkMode ? '#2a2e39' : '#e0e3eb',
        },
        horzLine: {
          color: darkMode ? 'rgba(180,190,210,0.4)' : 'rgba(100,110,130,0.4)',
          width: 1,
          style: 3,
          labelBackgroundColor: darkMode ? '#2a2e39' : '#e0e3eb',
        },
      },
      timeScale: {
        borderColor: darkMode ? 'rgba(42,46,57,0.8)' : '#e0e3eb',
        rightOffset: 12,
        barSpacing: isMobile ? 5 : 10,
        minBarSpacing: 2,
        timeVisible: true,
        secondsVisible: chartInterval === '1m',
        tickMarkFormatter: (time, tickMarkType, locale) => {
          const d = new Date((time + timezoneOffset) * 1000);
          if (tickMarkType === 1 || tickMarkType === 2) { 
             return `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`;
          }
          return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
        },
      },
      rightPriceScale: {
        borderColor: darkMode ? 'rgba(42,46,57,0.8)' : '#e0e3eb',
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const volSeries = chart.addHistogramSeries({
      color: 'rgba(8,153,129,0.35)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.84, bottom: 0 },
    });

    chartInstance.current = chart; 
    volumeSeries.current = volSeries;
    
    const cSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
    });
    candleSeries.current = cSeries;
    
    setChartCreated(true);

    if (onCrosshairMove) {
      chart.subscribeCrosshairMove(onCrosshairMove);
    }

    const ro = new ResizeObserver(entries => { 
      if (entries[0] && chartInstance.current) {
        chartInstance.current.applyOptions({ width: entries[0].contentRect.width, height: entries[0].contentRect.height }); 
      }
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      if (onCrosshairMove) chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      chartInstance.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      setChartCreated(false);
    };
  }, [timezoneOffset, chartInterval, isMobile]); // Recreate if these structural props change

  // Apply theme dynamically without recreating chart
  useEffect(() => {
    if (chartInstance.current && chartCreated) {
      chartInstance.current.applyOptions({
        layout: {
          background: { color: darkMode ? '#0d1117' : '#ffffff' },
          textColor: darkMode ? '#c9d1d9' : '#131722',
        },
        grid: {
          vertLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
          horzLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
        },
        timeScale: {
          borderColor: darkMode ? 'rgba(42,46,57,0.8)' : '#e0e3eb',
        },
        rightPriceScale: {
          borderColor: darkMode ? 'rgba(42,46,57,0.8)' : '#e0e3eb',
        }
      });
    }
  }, [darkMode, chartCreated]);
  return (
    <div ref={chartRef} className="absolute inset-0" style={{ zIndex: 1 }} />
  );
});

export default Canvas2DChartEngine;
