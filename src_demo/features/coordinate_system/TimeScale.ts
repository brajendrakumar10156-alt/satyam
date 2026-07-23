// Master Time Scale (Coordinate System)
export class TimeScale {
    private visibleTimeRange: { start: number, end: number } = { start: 0, end: 1000 };
    private width: number = 800;

    constructor() {}

    public setRange(start: number, end: number) {
        this.visibleTimeRange = { start, end };
    }

    public setWidth(width: number) {
        this.width = width;
    }

    public timeToCoordinate(time: number): number {
        const range = this.visibleTimeRange.end - this.visibleTimeRange.start;
        if (range <= 0) return 0;
        return ((time - this.visibleTimeRange.start) / range) * this.width;
    }

    public coordinateToTime(x: number): number {
        if (this.width <= 0) return 0;
        const range = this.visibleTimeRange.end - this.visibleTimeRange.start;
        return this.visibleTimeRange.start + (x / this.width) * range;
    }
}
