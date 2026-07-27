import { useEffect } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

export const useLightweightCharts = (props: any) => {
  const { chartRef, renderEngine, chartInstance, candleSeries, t, darkMode, selectedCoin, subChartsMapRef, isDrawing, handleNativeWheel } = props;

useEffect(() => {
    if (!chartRef.current || renderEngine !== 'canvas2d') return;
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
        rightOffset: 20,
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
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
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
    setChartCreated(true);

    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        updateCrosshairDOM(param.time);
      } else {
        updateCrosshairDOM(null);
      }
    });

    // Old click handler removed to avoid conflicts
    const ro = new ResizeObserver(entries => { 
      if (entries[0] && chartInstance.current) {
        chartInstance.current.applyOptions({ width: entries[0].contentRect.width, height: entries[0].contentRect.height }); 
      }
    });
    const domElement = chartRef.current;
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!chartInstance.current) return;
      const ts = chartInstance.current.timeScale();
      const logicalRange = ts.getVisibleLogicalRange();
      if (!logicalRange) return;

      const rect = domElement.getBoundingClientRect();
      const px = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const ratio = px / Math.max(1, rect.width);
      const rangeLen = logicalRange.to - logicalRange.from;

      const isTouchpadPinch = e.ctrlKey;
      const isHorizontalTrackpadPan = !e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2;

      if (isHorizontalTrackpadPan) {
        // Laptop Touchpad Two-Finger Horizontal Swipe Panning
        const shiftCandles = (e.deltaX / Math.max(1, rect.width)) * rangeLen * 0.8;
        ts.setVisibleLogicalRange({
          from: logicalRange.from + shiftCandles,
          to: logicalRange.to + shiftCandles
        });
      } else {
        // Laptop Touchpad Pinch-to-Zoom AND Mouse Wheel Zoom
        const delta = isTouchpadPinch ? e.deltaY * 6.0 : e.deltaY;
        const zoomSensitivity = 0.0018;
        const zoomFactor = Math.exp(delta * zoomSensitivity);

        const pivot = logicalRange.from + (rangeLen * ratio);
        const newLen = Math.max(5, Math.min(50000, rangeLen * zoomFactor));

        const newFrom = pivot - (newLen * ratio);
        const newTo = pivot + (newLen * (1 - ratio));

        ts.setVisibleLogicalRange({ from: newFrom, to: newTo });
      }
    };

    domElement.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      domElement.removeEventListener('wheel', handleNativeWheel);
      ro.disconnect();
      chart.remove();
      chartInstance.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      setChartCreated(false);
    };
  }, [chartRef, renderEngine, chartInstance, candleSeries, t, darkMode, selectedCoin, subChartsMapRef, isDrawing, handleNativeWheel]);
};
