// Expose WebGPU types required by @mlc-ai/web-llm without changing whole project tsconfig
interface Navigator {
    gpu: any;
}
