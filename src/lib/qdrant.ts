import { QdrantClient } from "@qdrant/js-client-rest";
import { EMBEDDING_DIMENSIONS } from "./embeddings.js";
import type { Chunk } from "./chunker.js";

const COLLECTION_NAME = "meetings";

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;

    if (!url) {
      throw new Error(
        "QDRANT_URL is not set. Get it from your Qdrant Cloud dashboard → Cluster → URL"
      );
    }

    if (!apiKey) {
      throw new Error(
        "QDRANT_API_KEY is not set. Get it from your Qdrant Cloud dashboard → Data Access Control → API Keys"
      );
    }

    client = new QdrantClient({ url, apiKey });
  }
  return client;
}

// Keep backward compat for test-connections.ts
export const qdrantClient = getQdrantClient();

/**
 * Creates the "meetings" collection if it doesn't already exist.
 *
 * Uses Cosine distance because OpenAI embeddings are normalized.
 * Cosine measures angle between vectors (meaning similarity)
 * regardless of vector magnitude.
 */
export async function createCollection(): Promise<void> {
  const qdrant = getQdrantClient();

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

  if (exists) {
    console.log(`Collection "${COLLECTION_NAME}" already exists, skipping creation.`);
  } else {
    const response = await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_DIMENSIONS,
        distance: "Cosine",
      },
    });
    console.log(`Collection "${COLLECTION_NAME}" created:`, response);
  }

  // Ensure payload index exists for meetingId filtering.
  // Qdrant Cloud requires an explicit index to filter on a field.
  // This is idempotent — calling it on an existing index is a no-op.
  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: "meetingId",
    field_schema: "keyword",
    wait: true,
  });
}

/**
 * Stores chunks + their vectors as Qdrant "points."
 *
 * A point = ID + vector + payload (metadata + text).
 * We use upsert (update-or-insert) so re-ingesting the same
 * meeting overwrites existing points instead of creating duplicates.
 *
 * IDs are deterministic: hash of meetingId + globalChunkIndex,
 * so the same chunk always maps to the same point.
 */
export async function upsertChunks(
  chunks: Chunk[],
  vectors: number[][]
): Promise<void> {
  if (chunks.length !== vectors.length) {
    throw new Error(
      `Mismatch: ${chunks.length} chunks but ${vectors.length} vectors`
    );
  }

  const qdrant = getQdrantClient();

  const points = chunks.map((chunk, i) => ({
    id: deterministicId(chunk.metadata.meetingId, chunk.metadata.globalChunkIndex),
    vector: vectors[i],
    payload: {
      text: chunk.text,
      ...chunk.metadata,
    },
  }));

  const response = await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points,
  });

  console.log(
    `Upserted ${points.length} points into "${COLLECTION_NAME}":`,
    response
  );
}

/**
 * Generates a deterministic unsigned 64-bit integer ID from meetingId + chunkIndex.
 * This ensures re-ingesting the same meeting overwrites the same points.
 *
 * Uses a simple string hash — not cryptographic, just needs to be
 * deterministic and well-distributed.
 */
function deterministicId(meetingId: string, globalChunkIndex: number): number {
  const str = `${meetingId}::${globalChunkIndex}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Qdrant needs positive integers
  return Math.abs(hash);
}

export { COLLECTION_NAME };
