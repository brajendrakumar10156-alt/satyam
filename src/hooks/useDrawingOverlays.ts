import { useEffect } from 'react';
import { INDICATOR_REGISTRY } from '../indicatorsRegistry';

export const useDrawingOverlays = (props: any) => {
  const { chartInstance, chartCreated, visualIndicators, latestCandleRef } = props;

useEffect(() => {
    if (!chartInstance.current || !chartCreated) return;

    // Get active indicators categorized by kind
    const activeOverlays = visualIndicators.filter(ind => ind.visible && INDICATOR_REGISTRY[ind.type]?.kind === 'overlay');
    const activeOscillators = visualIndicators.filter(ind => ind.visible && INDICATOR_REGISTRY[ind.type]?.kind === 'subchart');

    // 1. Clean up removed indicator series on MAIN chart
    const activeMainKeys = new Set();
    activeOverlays.forEach(ind => {
      const reg = INDICATOR_REGISTRY[ind.type];
      if (reg) {
        reg.seriesConfig.forEach(s => {
          activeMainKeys.add(`${ind.id}_${s.key}`);
        });
      }
    });

    Object.keys(indicatorSeriesRef.current).forEach(key => {
      if (!activeMainKeys.has(key)) {
        try {
          chartInstance.current.removeSeries(indicatorSeriesRef.current[key]);
        } catch (e) {}
        delete indicatorSeriesRef.current[key];
      }
    });

    // 2. Destroy sub-charts that are no longer active
    Object.keys(subChartsMapRef.current).forEach(id => {
      if (!activeOscillators.some(ind => ind.id === id)) {
        try {
          subChartsMapRef.current[id].unsubscribeSync?.();
          subChartsMapRef.current[id].chart.remove();
        } catch (e) {}
        delete subChartsMapRef.current[id];
      }
    });

    // 3. Create active main-chart overlays
    activeOverlays.forEach(ind => {
      const reg = INDICATOR_REGISTRY[ind.type];
      if (!reg) return;
      reg.seriesConfig.forEach(s => {
        const key = `${ind.id}_${s.key}`;
        if (!indicatorSeriesRef.current[key]) {
          const options = s.options(ind.params, ind.color);
          let series;
          if (s.type === 'histogram') {
            series = chartInstance.current.addHistogramSeries(options);
          } else {
            series = chartInstance.current.addLineSeries(options);
          }
          indicatorSeriesRef.current[key] = series;
        }
      });
    });

    // 4. Create active oscillators in sub-panes
    activeOscillators.forEach(ind => {
      const reg = INDICATOR_REGISTRY[ind.type];
      if (!reg) return;
      const container = document.getElementById(`subchart-container-${ind.id}`);
      if (!container) return;

      let subChartObj = subChartsMapRef.current[ind.id];
      if (!subChartObj) {
        const chart = createChart(container, {
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
        kinematicScroll: { mouse: true },

          layout: {
            background: { type: 'solid', color: darkMode ? '#131722' : '#ffffff' },
            textColor: darkMode ? '#c9d1d9' : '#131722',
          },
          grid: {
            vertLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
            horzLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
          },
          timeScale: {
            visible: true,
            borderColor: darkMode ? '#2a2e39' : '#e0e3eb',
          },
          rightPriceScale: {
            borderColor: darkMode ? '#2a2e39' : '#e0e3eb',
          },
          width: container.clientWidth,
          height: container.clientHeight,
        });

        const seriesList = {};
        reg.seriesConfig.forEach(s => {
          const options = s.options(ind.params, ind.color);
          let series;
          if (s.type === 'histogram') {
            series = chart.addHistogramSeries(options);
          } else {
            series = chart.addLineSeries(options);
          }
          seriesList[s.key] = series;
        });

        // Bi-directional timescale sync
        const mainTimeScale = chartInstance.current.timeScale();
        const subTimeScale = chart.timeScale();

        const syncMainToSub = throttle((range) => { if (range) subTimeScale.setVisibleRange(range); }, 16);
        const syncSubToMain = throttle((range) => { if (range) mainTimeScale.setVisibleRange(range); }, 16);

        mainTimeScale.subscribeVisibleTimeRangeChange(syncMainToSub);
        subTimeScale.subscribeVisibleTimeRangeChange(syncSubToMain);

        subChartObj = {
          chart,
          seriesList,
          unsubscribeSync: () => {
            mainTimeScale.unsubscribeVisibleTimeRangeChange(syncMainToSub);
            subTimeScale.unsubscribeVisibleTimeRangeChange(syncSubToMain);
          }
        };
        subChartsMapRef.current[ind.id] = subChartObj;
      }
    });

    setIndicatorStructureTick(prev => prev + 1);
  }, [chartInstance, chartCreated, visualIndicators, latestCandleRef]);
};
