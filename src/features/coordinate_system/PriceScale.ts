// Master Price Scale (Coordinate System)
export class PriceScale {
    private visiblePriceRange: { min: number, max: number } = { min: 0, max: 1000 };
    private height: number = 600;

    constructor() {}

    public setRange(min: number, max: number) {
        this.visiblePriceRange = { min, max };
    }

    public setHeight(height: number) {
        this.height = height;
    }

    public priceToCoordinate(price: number): number {
        const range = this.visiblePriceRange.max - this.visiblePriceRange.min;
        if (range <= 0) return 0;
        return (1.0 - ((price - this.visiblePriceRange.min) / range)) * this.height;
    }

    public coordinateToPrice(y: number): number {
        if (this.height <= 0) return 0;
        const range = this.visiblePriceRange.max - this.visiblePriceRange.min;
        return this.visiblePriceRange.min + ((1.0 - (y / this.height)) * range);
    }
}
