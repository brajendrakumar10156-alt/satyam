cmake_minimum_required(VERSION 3.18)
project(QuantaAI_CUDA_HFT_Engine LANGUAGES CXX CUDA)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CUDA_STANDARD 17)

# Enable AVX2 / SIMD vectorization for CPU
if(MSVC)
    add_compile_options(/arch:AVX2 /O2)
else()
    add_compile_options(-mavx2 -O3)
endif()

include_directories(${CMAKE_CURRENT_SOURCE_DIR})

add_executable(quantaai_cuda_engine
    server_main.cpp
    hft_engine.cpp
    cuda_kernel.cu
)

set_target_properties(quantaai_cuda_engine PROPERTIES
    CUDA_SEPARABLE_COMPILATION ON
)
