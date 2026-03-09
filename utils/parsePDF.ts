import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore: Vite ?url import syntax doesn't type gracefully
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { nanoid } from "nanoid";
import { LifeOSDataRecord } from "../types/data";
import { keywordExtract, textEmbedding } from "./embeddings";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function parsePDF(
    file: File,
    sourceId: string
): Promise<LifeOSDataRecord[]> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocs = await loadingTask.promise;
    const numPages = pdfDocs.numPages;
    const records: LifeOSDataRecord[] = [];

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocs.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        const text = strings.join(" ").replace(/\s+/g, " ").trim();

        if (!text) continue;

        const keywords = await keywordExtract(text);
        const embedding = await textEmbedding(text);

        records.push({
            id: nanoid(),
            sourceId,
            timestamp: Date.now(),
            summary: `Page ${i}: ${text.slice(0, 100)}...`,
            numericFields: {},
            categoricalFields: { type: "Document Page" },
            textFields: [text],
            keywords: [...new Set(keywords)],
            embedding,
            raw: { page: i, file: file.name },
        });
    }

    return records;
}
