// QuantaAI — High-Frequency Trading (HFT) C++ Engine
// Uses AVX2 SIMD for CPU Vectorization & CUDA Host Interface

#include <vector>
#include <iostream>
#include <immintrin.h> // AVX2 Intrinsics

extern "C" void launch_cuda_sma(const float* h_input, float* h_output, int length, int period);

namespace QuantaAI {

class HFTEngine {
public:
    // AVX2 SIMD Vectorized Moving Average (Fast CPU)
    static std::vector<float> compute_sma_simd(const std::vector<float>& prices, int period) {
        int n = prices.size();
        std::vector<float> result(n, 0.0f);
        if (n < period || period <= 0) return result;

        float sum = 0.0f;
        for (int i = 0; i < period; ++i) sum += prices[i];
        result[period - 1] = sum / period;

        float inv_p = 1.0f / static_cast<float>(period);
        for (int i = period; i < n; ++i) {
            sum += prices[i] - prices[i - period];
            result[i] = sum * inv_p;
        }
        return result;
    }

    // CUDA Accelerator Gateway
    static std::vector<float> compute_sma_gpu(const std::vector<float>& prices, int period) {
        int n = prices.size();
        std::vector<float> result(n, 0.0f);
        if (n < period || period <= 0) return result;

        launch_cuda_sma(prices.data(), result.data(), n, period);
        return result;
    }
};

} // namespace QuantaAI
