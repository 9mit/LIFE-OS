import * as webllm from '@mlc-ai/web-llm';
import { LifeOSDataRecord, InsightSummary } from '../types/data';

// We use Phi-3 as it is extremely capable for its small size and runs well in WebGPU
export const SELECTED_MODEL = "Phi-3-mini-4k-instruct-q4f16_1-MLC";
let engine: webllm.MLCEngineInterface | null = null;
let isInitializing = false;
let initPromise: Promise<webllm.MLCEngineInterface> | null = null;

export type EngineInitProgressCallback = (info: webllm.InitProgressReport) => void;

export async function getLLMEngine(
    progressCallback?: EngineInitProgressCallback
): Promise<webllm.MLCEngineInterface | null> {
    // Return existing
    if (engine) return engine;

    // Await in-progress init
    if (isInitializing && initPromise) {
        return initPromise;
    }

    // Ensure WebGPU is available
    if (!navigator.gpu) {
        console.warn("WebGPU not supported on this browser. Local LLM may not work.");
        return null;
    }

    isInitializing = true;

    initPromise = new Promise(async (resolve, reject) => {
        try {
            const newEngine = new webllm.MLCEngine();
            if (progressCallback) {
                newEngine.setInitProgressCallback(progressCallback);
            }
            await newEngine.reload(SELECTED_MODEL);
            engine = newEngine;
            resolve(engine);
        } catch (err) {
            console.error("Failed to initialize WebLLM:", err);
            reject(err);
        } finally {
            isInitializing = false;
            initPromise = null;
        }
    });

    return initPromise;
}

export async function generateLocalLLMResponse(
    question: string,
    relevantContext: LifeOSDataRecord[],
    systemSummary: InsightSummary,
    chatHistory: { role: "user" | "assistant", content: string }[],
    onChunk: (chunk: string) => void
): Promise<string> {
    const llm = await getLLMEngine();

    if (!llm) {
        throw new Error("Local LLM engine not available (WebGPU unsupported or model failed to load).");
    }

    // Construct the prompt with RAG context
    const contextText = relevantContext.length
        ? relevantContext.map(r => r.summary).join("\n")
        : "No highly relevant specific records found, but here are some general stats: " + systemSummary.narrative;

    const systemPrompt = `You are LifeOS, a private, offline personal intelligence hub. 
Your goal is to answer the user's questions about their data insightfully and clearly.
Be concise but helpful. Use markdown formatting.

Here is the retrieved context from the user's personal data:
<context>
${contextText}
</context>

Here is a high-level summary of their overall profile:
<profile>
${systemSummary.narrative}
</profile>

Answer the user's question based strictly on the provided context and profile. Do not invent personal details.
`;

    // Build the message history
    const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt }
    ];

    // Context limit - only pass last 5 interactions to save token space
    const recentHistory = chatHistory.slice(-5);
    recentHistory.forEach(msg => messages.push({ role: msg.role as "user" | "assistant", content: msg.content }));

    // Add the current question
    if (recentHistory.length === 0 || recentHistory[recentHistory.length - 1].content !== question) {
        messages.push({ role: "user", content: question });
    }

    const completion = await llm.chat.completions.create({
        messages,
        temperature: 0.3, // Low temperature for more factual responses
        max_tokens: 500,
        stream: true,
    });

    let fullResponse = "";
    for await (const chunk of completion) {
        const textChunk = chunk.choices[0]?.delta?.content || "";
        fullResponse += textChunk;
        onChunk(fullResponse);
    }

    return fullResponse;
}
