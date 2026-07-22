#include <iostream>
#include <vector>
#include <numeric>

// WSL / Server Backend C++ Math Engine
// HFT (High-Frequency Trading) calculations running natively on the Server CPU/CUDA.
// Absolutely zero JS garbage collection. Direct RAM access.

extern "C" {

    // Computes SMA at microseconds speed for Server-side Arbitrage
    void calculate_sma_hft(const float* prices, int length, int period, float* out_result) {
        if (length < period || period <= 0) return;

        float sum = 0.0f;
        for (int i = 0; i < period; ++i) {
            sum += prices[i];
        }
        
        out_result[period - 1] = sum / period;

        for (int i = period; i < length; ++i) {
            sum += prices[i] - prices[i - period];
            out_result[i] = sum / period;
        }
    }

}
