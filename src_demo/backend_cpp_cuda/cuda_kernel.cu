// QuantaAI — CUDA High-Frequency Parallel Calculation Kernel
// Executed on NVIDIA GPU Servers (CUDA C++)

#include <cuda_runtime.h>
#include <iostream>

// CUDA Kernel: Parallel SMA Calculation across millions of data points
__global__ void compute_sma_cuda_kernel(const float* d_input, float* d_output, int length, int period) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= length) return;

    if (idx < period - 1) {
        d_output[idx] = 0.0f;
        return;
    }

    float sum = 0.0f;
    for (int i = idx - period + 1; i <= idx; ++i) {
        sum += d_input[i];
    }
    d_output[idx] = sum / static_cast<float>(period);
}

// C++ Host Wrapper for CUDA Kernel Call
extern "C" void launch_cuda_sma(const float* h_input, float* h_output, int length, int period) {
    size_t bytes = length * sizeof(float);

    float *d_input = nullptr;
    float *d_output = nullptr;

    cudaMalloc((void**)&d_input, bytes);
    cudaMalloc((void**)&d_output, bytes);

    cudaMemcpy(d_input, h_input, bytes, cudaMemcpyHostToDevice);

    int threadsPerBlock = 256;
    int blocksPerGrid = (length + threadsPerBlock - 1) / threadsPerBlock;

    compute_sma_cuda_kernel<<<blocksPerGrid, threadsPerBlock>>>(d_input, d_output, length, period);

    cudaDeviceSynchronize();

    cudaMemcpy(h_output, d_output, bytes, cudaMemcpyDeviceToHost);

    cudaFree(d_input);
    cudaFree(d_output);
}
