// We communicate with the Web Worker to run Xenova/transformers in a background thread
let worker: Worker | null = null;
let messageIdCounter = 0;
const pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker {
  if (typeof window === "undefined") {
    throw new Error("Worker can only be initialized in the browser environment.");
  }
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

    worker.addEventListener("message", (event) => {
      const { id, status, vector, error } = event.data;

      // Handle progress updates (could be hooked into a global store later if needed)
      if (status === "progress") {
        return;
      }

      const pending = pendingRequests.get(id);
      if (pending) {
        if (status === "complete") {
          pending.resolve(vector);
        } else {
          pending.reject(new Error(error || "Worker failed to generate embedding"));
        }
        pendingRequests.delete(id);
      }
    });
  }
  return worker;
}

const EMBEDDING_SIZE = 384; // all-MiniLM-L6-v2 produces 384-dimensional vectors
const DEFAULT_VECTOR = new Array(EMBEDDING_SIZE).fill(0);

export async function textEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) return [...DEFAULT_VECTOR];

  try {
    const workerInstance = getWorker();
    const id = ++messageIdCounter;

    return await new Promise<number[]>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      workerInstance.postMessage({ id, text });
    });
  } catch (err) {
    console.error("Embedding generation failed, falling back to zeros:", err);
    return [...DEFAULT_VECTOR];
  }
}

// Common stop words to filter out
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
  'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'me', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'you', 'he', 'she', 'it', 'we', 'they',
  'provide', 'give', 'show', 'tell', 'format', 'structured', 'please'
]);

export async function keywordExtract(text: string): Promise<string[]> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));

  const counts: Record<string, number> = {};
  tokens.forEach(t => { counts[t] = (counts[t] || 0) + 1; });

  const result = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 10);

  return result.length > 0 ? result : tokens.slice(0, 5);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}
