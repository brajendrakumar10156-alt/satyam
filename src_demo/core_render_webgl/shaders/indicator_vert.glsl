// Native GLSL Universal Translator (Vertex Shader)
attribute vec2 aPosition; // x = timeIndex, y = price
uniform vec2 uResolution;
uniform vec2 uPriceRange; // x = minPrice, y = maxPrice
uniform vec2 uTimeRange; // x = startIndex, y = endIndex
uniform vec4 uColor;
varying vec4 vColor;

void main() {
    vColor = uColor;
    
    // Normalize Time Index to Screen X (-1.0 to 1.0)
    float visiblePoints = uTimeRange.y - uTimeRange.x;
    float normalizedX = (aPosition.x - uTimeRange.x) / visiblePoints;
    float screenX = (normalizedX * 2.0) - 1.0;
    
    // Normalize Price to Screen Y (-1.0 to 1.0)
    float priceSpread = uPriceRange.y - uPriceRange.x;
    float normalizedY = 0.5;
    if (priceSpread > 0.0) {
        normalizedY = (aPosition.y - uPriceRange.x) / priceSpread;
    }
    float screenY = (normalizedY * 2.0) - 1.0;

    gl_Position = vec4(screenX, screenY, 0.0, 1.0);
}
