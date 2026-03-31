import OpenAI from "openai";
import { embedText } from "./embeddings.js";
import { getQdrantClient, COLLECTION_NAME } from "./qdrant.js";

const ANSWER_MODEL = "gpt-4o-mini";
const MIN_SIMILARITY_SCORE = 0.2;

export interface SearchResult {
  text: string;
  score: number;
  meetingId: string;
  meetingTitle: string;
  sourceFile: string;
  chunkIndex: number;
  globalChunkIndex: number;
}

export interface RAGAnswer {
  answer: string;
  sources: SearchResult[];
}

/**
 * Embeds the query and searches Qdrant for the nearest chunks.
 *
 * How it works:
 * 1. Your question gets embedded into the same 1536-dim space as the chunks
 * 2. Qdrant finds the K points whose vectors are closest (highest cosine similarity)
 * 3. A score of 1.0 = identical meaning, 0.0 = completely unrelated
 *
 * Scores above 0.75 are usually strong matches. Below 0.5 is noise.
 * These thresholds vary by domain — we'll calibrate in Step 6.
 */
export async function searchMeetings(
  query: string,
  topK: number = 5,
  meetingId?: string
): Promise<SearchResult[]> {
  const queryVector = await embedText(query);
  const qdrant = getQdrantClient();

  const filter = meetingId
    ? { must: [{ key: "meetingId", match: { value: meetingId } }] }
    : undefined;

  const results = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
    filter,
  });

  return results
    .filter((point) => point.score >= MIN_SIMILARITY_SCORE)
    .map((point) => {
      const payload = point.payload as Record<string, unknown>;
      return {
        text: payload.text as string,
        score: point.score,
        meetingId: payload.meetingId as string,
        meetingTitle: payload.meetingTitle as string,
        sourceFile: payload.sourceFile as string,
        chunkIndex: payload.chunkIndex as number,
        globalChunkIndex: payload.globalChunkIndex as number,
      };
    });
}

/**
 * Full RAG: search → build prompt → LLM → cited answer.
 *
 * The prompt tells the LLM to ONLY use the provided context.
 * This is called "grounding" — it prevents hallucination by
 * constraining the model to answer from retrieved evidence only.
 */
export async function askMeetings(
  question: string,
  meetingId?: string,
  topK: number = 5
): Promise<RAGAnswer> {
  const sources = await searchMeetings(question, topK, meetingId);

  if (sources.length === 0) {
    return {
      answer: "No relevant meeting content found for this question.",
      sources: [],
    };
  }

  // Build context block from retrieved chunks
  const contextBlocks = sources.map(
    (s, i) =>
      `[Source ${i + 1}] Meeting: "${s.meetingTitle}" (${s.meetingId}), Chunk ${s.chunkIndex}, Score: ${s.score.toFixed(3)}\n${s.text}`
  );
  const context = contextBlocks.join("\n\n---\n\n");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: ANSWER_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `You are a meeting intelligence assistant. Answer questions using ONLY the meeting transcript excerpts provided below. If the answer is not in the provided context, say "I don't have enough context to answer that."

For each claim in your answer, cite the source using [Source N] format.

Context:
${context}`,
      },
      {
        role: "user",
        content: question,
      },
    ],
  });

  const answer = response.choices[0].message.content ?? "No response generated.";

  return { answer, sources };
}
