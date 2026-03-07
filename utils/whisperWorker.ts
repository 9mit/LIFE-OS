import { env, pipeline, AutomaticSpeechRecognitionPipeline, PipelineType } from "@xenova/transformers";

env.allowLocalModels = false;
const MODEL_NAME = "Xenova/whisper-tiny.en";

type PipelineLoader = Promise<AutomaticSpeechRecognitionPipeline>;

class WhisperPipelineFactory {
    static task: PipelineType = "automatic-speech-recognition";
    static model = MODEL_NAME;
    static instance: PipelineLoader | null = null;

    static async getInstance(
        progress_callback?: (info: any) => void
    ): Promise<AutomaticSpeechRecognitionPipeline> {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, {
                quantized: true,
                progress_callback,
            }) as PipelineLoader;
        }
        return this.instance;
    }
}

self.addEventListener("message", async (event: MessageEvent) => {
    const { id, audio } = event.data;

    const transcriber = await WhisperPipelineFactory.getInstance((info) => {
        self.postMessage({ id, status: "progress", ...info });
    });

    try {
        const result = await transcriber(audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: "english",
            task: "transcribe",
        });

        // result contains { text: string }
        self.postMessage({ id, status: "complete", text: (result as any).text });
    } catch (error: any) {
        self.postMessage({ id, status: "error", error: error.message });
    }
});
