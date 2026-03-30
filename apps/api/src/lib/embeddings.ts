import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Get it from https://platform.openai.com/api-keys"
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Embed a single string. Returns a 1536-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  const vector = response.data[0].embedding;

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`
    );
  }

  return vector;
}

/**
 * Embed multiple strings in a single API call.
 * OpenAI supports up to 2048 inputs per batch.
 * Returns vectors in the same order as the input.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (texts.length > 2048) {
    throw new Error(
      `OpenAI supports max 2048 inputs per batch, got ${texts.length}. Split into smaller batches.`
    );
  }

  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  // OpenAI may return embeddings out of order — sort by index
  const sorted = response.data.sort((a, b) => a.index - b.index);
  return sorted.map((item) => item.embedding);
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
