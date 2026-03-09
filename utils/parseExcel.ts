import { read, utils } from "xlsx";
import { nanoid } from "nanoid";
import { LifeOSDataRecord } from "../types/data";
import { keywordExtract, textEmbedding } from "./embeddings";
import { normalizeValue, parseDateGuess } from "./utils";

export async function parseExcel(
    file: File,
    sourceId: string
): Promise<LifeOSDataRecord[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer, { type: "array" });

    if (!workbook.SheetNames.length) return [];

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json<Record<string, any>>(firstSheet);

    return Promise.all(
        data.map(async (row) => {
            const numericFields: Record<string, number> = {};
            const categoricalFields: Record<string, string> = {};
            const textBuckets: string[] = [];
            let keywords: string[] = [];

            for (const [key, value] of Object.entries(row)) {
                if (value === undefined || value === null || value === "") continue;
                const normalizedKey = key.trim();
                const normalizedValue = String(value).trim();

                const numeric = Number(normalizedValue);
                if (!Number.isNaN(numeric) && normalizedValue !== "") {
                    numericFields[normalizedKey] = numeric;
                } else {
                    categoricalFields[normalizedKey] = normalizeValue(normalizedValue);
                }

                textBuckets.push(`${normalizedKey}: ${normalizedValue}`);
                const extractedKeywords = await keywordExtract(normalizedValue);
                keywords.push(...extractedKeywords);
            }

            const combinedText = textBuckets.join(" | ");
            const embedding = await textEmbedding(combinedText);
            const timestamp = parseDateGuess(row);

            return {
                id: nanoid(),
                sourceId,
                timestamp,
                summary: combinedText.slice(0, 150) || file.name,
                numericFields,
                categoricalFields,
                textFields: textBuckets,
                keywords: [...new Set(keywords)],
                embedding,
                raw: row,
            } satisfies LifeOSDataRecord;
        })
    );
}
