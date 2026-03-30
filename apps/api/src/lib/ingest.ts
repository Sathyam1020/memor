import { chunkTranscript, type Chunk } from "./chunker.js";
import { embedBatch } from "./embeddings.js";
import { createCollection, upsertChunks } from "./qdrant.js";

interface IngestOptions {
  meetingId: string;
  meetingTitle: string;
  sourceFile: string;
  globalChunkOffset?: number;
}

/**
 * Full ingest pipeline: chunk → batch embed → store in Qdrant.
 *
 * Batching matters: embedding 100 chunks one-by-one = 100 API calls
 * (~15 seconds, 100x the rate limit pressure). Batching = 1 API call
 * (~0.3 seconds). At 10,000 chunks the difference is minutes vs seconds,
 * and cost is the same either way (OpenAI charges per token, not per call).
 *
 * We batch embeddings in groups of 2048 (OpenAI's max per call) and
 * Qdrant upserts in groups of 100 (keeps request payloads reasonable).
 */
export async function ingestTranscript(
  text: string,
  options: IngestOptions
): Promise<{ chunksIngested: number }> {
  // Ensure collection exists
  await createCollection();

  // 1. Chunk
  const chunks = chunkTranscript(text, {
    meetingId: options.meetingId,
    meetingTitle: options.meetingTitle,
    sourceFile: options.sourceFile,
    globalChunkOffset: options.globalChunkOffset,
  });

  if (chunks.length === 0) {
    console.log("No chunks produced — file may be empty.");
    return { chunksIngested: 0 };
  }

  console.log(`Chunked into ${chunks.length} pieces.`);

  // 2. Batch embed (max 2048 per OpenAI call)
  const EMBED_BATCH_SIZE = 2048;
  const allVectors: number[][] = [];

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const batchTexts = batch.map((c) => c.text);
    const batchEnd = Math.min(i + EMBED_BATCH_SIZE, chunks.length);
    console.log(`Embedding chunks ${i + 1}-${batchEnd}/${chunks.length}...`);
    const vectors = await embedBatch(batchTexts);
    allVectors.push(...vectors);
  }

  // 3. Batch upsert to Qdrant (100 points per call)
  const UPSERT_BATCH_SIZE = 100;

  for (let i = 0; i < chunks.length; i += UPSERT_BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + UPSERT_BATCH_SIZE);
    const batchVectors = allVectors.slice(i, i + UPSERT_BATCH_SIZE);
    const batchEnd = Math.min(i + UPSERT_BATCH_SIZE, chunks.length);
    console.log(`Upserting chunks ${i + 1}-${batchEnd}/${chunks.length}...`);
    await upsertChunks(batchChunks, batchVectors);
  }

  console.log(`✓ Ingested ${chunks.length} chunks for "${options.meetingTitle}".`);
  return { chunksIngested: chunks.length };
}
