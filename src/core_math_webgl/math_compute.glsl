precision highp float;
precision highp int;

uniform sampler2D u_dataTexture;
uniform int u_totalCandles;
uniform int u_period;
uniform int u_indicator; // 0=SMA, 1=RSI, 2=MACD

// Passed from vertex shader
varying vec2 v_texCoord;

// Fetch data from a 1D index out of the 2D texture (encoded as RGBA float)
float getData(int index) {
    if (index < 0 || index >= u_totalCandles) { return 0.0; }
    // Calculate 2D coordinates for the texture (assuming max texture size e.g. 4096)
    int width = 4096;
    int x = index - (index / width) * width;
    int y = index / width;
    
    // Convert to 0.0 - 1.0 range based on texture size
    float texX = (float(x) + 0.5) / float(width);
    float texY = (float(y) + 0.5) / float(width); // Assuming square texture for simplicity
    
    vec4 texel = texture2D(u_dataTexture, vec2(texX, texY));
    return texel.r; // Since we use OES_texture_float or gl.FLOAT for internal format
}

void main() {
    // Current index in the 1D array
    int width = 4096;
    int x = int(v_texCoord.x * float(width));
    int y = int(v_texCoord.y * float(width)); // Assuming square for now
    int index = y * width + x;

    if (index >= u_totalCandles) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    if (u_indicator == 0) { // SMA
        if (index < u_period - 1) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        float sum = 0.0;
        for (int i = 0; i < 4096; i++) {
            if (i >= u_period) break; // Variable loops are restricted in WebGL1, must break
            sum += getData(index - i);
        }
        gl_FragColor = vec4(sum / float(u_period), 0.0, 0.0, 1.0);
    } 
    else if (u_indicator == 1) { // RSI
        if (index <= u_period) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
        float gainSum = 0.0;
        float lossSum = 0.0;
        for (int i = 0; i < 4096; i++) {
            if (i >= u_period) break;
            int curr = index - i;
            float diff = getData(curr) - getData(curr - 1);
            if (diff > 0.0) {
                gainSum += diff;
            } else {
                lossSum -= diff;
            }
        }
        float avgGain = gainSum / float(u_period);
        float avgLoss = lossSum / float(u_period);
        if (avgLoss == 0.0) {
            gl_FragColor = vec4(100.0, 0.0, 0.0, 1.0);
        } else {
            float rs = avgGain / avgLoss;
            gl_FragColor = vec4(100.0 - (100.0 / (1.0 + rs)), 0.0, 0.0, 1.0);
        }
    }
    else {
        gl_FragColor = vec4(getData(index), 0.0, 0.0, 1.0);
    }
}
