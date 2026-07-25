/**
 * QuantaAI Dedicated Mouse & Touch Interaction Manager
 * Pure TypeScript module managing cursor-anchored zoom-in, zoom-out, drag panning,
 * and historical lazy loading across WebGPU, WebGL, and Canvas2D engines.
 */

export interface ViewportState {
  from: number;
  to: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface InteractionOptions {
  minVisibleCandles?: number;
  maxVisibleCandles?: number;
  zoomSensitivity?: number;
  onViewportChange: (newViewport: ViewportState) => void;
  onCursorMove?: (x: number, y: number) => void;
  onHistoricalLazyLoad?: (fromIndex: number) => void;
}

export class MouseInteractionManager {
  private element: HTMLElement | null = null;
  private viewport: ViewportState = { from: 0, to: 100 };
  private options: InteractionOptions;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialViewport: ViewportState = { from: 0, to: 100 };

  constructor(options: InteractionOptions) {
    this.options = {
      minVisibleCandles: 5,
      maxVisibleCandles: 50000,
      zoomSensitivity: 0.0018,
      ...options,
    };
  }

  /**
   * Attaches wheel, drag, and pointer listeners to target element with non-passive event capture
   */
  public attach(element: HTMLElement, initialViewport?: ViewportState) {
    this.detach();
    this.element = element;
    if (initialViewport) {
      this.viewport = { ...initialViewport };
    }

    element.addEventListener('wheel', this.handleWheel, { passive: false });
    element.addEventListener('pointerdown', this.handlePointerDown);
    element.addEventListener('pointermove', this.handlePointerMove);
    element.addEventListener('pointerup', this.handlePointerUp);
    element.addEventListener('pointercancel', this.handlePointerUp);
    element.addEventListener('pointerleave', this.handlePointerLeave);
  }

  /**
   * Cleans up event listeners when component unmounts
   */
  public detach() {
    if (!this.element) return;
    this.element.removeEventListener('wheel', this.handleWheel);
    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('pointermove', this.handlePointerMove);
    this.element.removeEventListener('pointerup', this.handlePointerUp);
    this.element.removeEventListener('pointercancel', this.handlePointerUp);
    this.element.removeEventListener('pointerleave', this.handlePointerLeave);
    this.element = null;
  }

  public setViewport(vp: ViewportState) {
    this.viewport = { ...vp };
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.element) return;
    const rect = this.element.getBoundingClientRect();
    const rangeLen = this.viewport.to - this.viewport.from;

    const isTouchpadPinch = e.ctrlKey;
    const isHorizontalTrackpadPan = !e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2;

    if (isHorizontalTrackpadPan) {
      // Laptop Touchpad Two-Finger Horizontal Swipe Panning
      const candlesPerPixel = rangeLen / Math.max(1, rect.width);
      const shift = (e.deltaX * 0.5) * candlesPerPixel;
      this.viewport.from += shift;
      this.viewport.to += shift;
    } else {
      // Laptop Touchpad Pinch-to-Zoom AND Mouse Wheel Zoom In / Zoom Out
      const px = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const ratio = Math.max(0, Math.min(1, px / Math.max(1, rect.width)));

      const delta = isTouchpadPinch ? e.deltaY * 6.0 : e.deltaY;
      const sens = this.options.zoomSensitivity || 0.0018;
      const zoomFactor = Math.exp(delta * sens);

      const pivotCandle = this.viewport.from + (rangeLen * ratio);
      const newLen = Math.max(
        this.options.minVisibleCandles || 5,
        Math.min(this.options.maxVisibleCandles || 50000, rangeLen * zoomFactor)
      );

      this.viewport.from = pivotCandle - (newLen * ratio);
      this.viewport.to = pivotCandle + (newLen * (1 - ratio));
    }

    // Trigger lazy loading of historical data when scrolling near left edge
    if (this.viewport.from < 20 && this.options.onHistoricalLazyLoad) {
      this.options.onHistoricalLazyLoad(this.viewport.from);
    }

    this.options.onViewportChange({ ...this.viewport });
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (!this.element) return;
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.initialViewport = { ...this.viewport };
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.element) return;
    const rect = this.element.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (this.options.onCursorMove) {
      this.options.onCursorMove(px, py);
    }

    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStartX;
    const rangeLen = this.initialViewport.to - this.initialViewport.from;
    const shiftCandles = -dx * (rangeLen / Math.max(1, rect.width));

    this.viewport.from = this.initialViewport.from + shiftCandles;
    this.viewport.to = this.initialViewport.to + shiftCandles;

    this.options.onViewportChange({ ...this.viewport });
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (!this.element) return;
    this.isDragging = false;
    try {
      this.element.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  private handlePointerLeave = () => {
    this.isDragging = false;
  };
}
