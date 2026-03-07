import { env, pipeline, FeatureExtractionPipeline, PipelineType } from "@xenova/transformers";

// Disable local models to fetch from Hugging Face hub (required for browser usage initially)
// In a standalone production app, these would be served from public/models
env.allowLocalModels = false;

// Define the model we want to use (fast, lightweight semantic understanding)
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

type PipelineLoader = Promise<FeatureExtractionPipeline>;

class PipelineFactory {
    static task: PipelineType = "feature-extraction";
    static model = MODEL_NAME;
    static instance: PipelineLoader | null = null;

    static async getInstance(
        progress_callback?: (info: any) => void
    ): Promise<FeatureExtractionPipeline> {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                progress_callback,
            }) as PipelineLoader;
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event: MessageEvent) => {
    const { id, text } = event.data;

    // Retrieve or initialize the pipeline
    const extractor = await PipelineFactory.getInstance((info) => {
        // We can emit progress back to UI here
        self.postMessage({ status: "progress", ...info });
    });

    try {
        // Generate the embedding vector
        const output = await extractor(text, {
            pooling: "mean",
            normalize: true,
        });

        // Convert Float32Array to standard array for serialization
        const vector = Array.from(output.data as Float32Array);

        // Send back to main thread
        self.postMessage({ id, status: "complete", vector });
    } catch (error: any) {
        self.postMessage({ id, status: "error", error: error.message });
    }
});
