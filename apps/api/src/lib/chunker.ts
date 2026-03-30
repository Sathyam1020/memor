/**
 * Splits a transcript into overlapping chunks for embedding.
 *
 * We approximate tokens as words (1 token ≈ 0.75 words for English).
 * OpenAI's tokenizer (tiktoken) would be exact, but adds a native
 * dependency. Word-based splitting is close enough for chunking —
 * the embedding model handles the real tokenization.
 */

export interface ChunkMetadata {
  meetingId: string;
  meetingTitle: string;
  sourceFile: string;
  chunkIndex: number;
  globalChunkIndex: number;
  totalChunks: number;
  createdAt: string;
}

export interface Chunk {
  text: string;
  metadata: ChunkMetadata;
}

interface ChunkOptions {
  meetingId: string;
  meetingTitle: string;
  sourceFile: string;
  globalChunkOffset?: number;
  tokensPerChunk?: number;
  overlapTokens?: number;
}

const DEFAULT_TOKENS_PER_CHUNK = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

// Rough approximation: 1 token ≈ 0.75 words in English
const WORDS_PER_TOKEN = 0.75;

function tokensToWords(tokens: number): number {
  return Math.round(tokens * WORDS_PER_TOKEN);
}

export function chunkTranscript(text: string, options: ChunkOptions): Chunk[] {
  const {
    meetingId,
    meetingTitle,
    sourceFile,
    globalChunkOffset = 0,
    tokensPerChunk = DEFAULT_TOKENS_PER_CHUNK,
    overlapTokens = DEFAULT_OVERLAP_TOKENS,
  } = options;

  const words = text.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) {
    return [];
  }

  const chunkSizeWords = tokensToWords(tokensPerChunk);
  const overlapWords = tokensToWords(overlapTokens);
  const stepSize = chunkSizeWords - overlapWords;

  if (stepSize <= 0) {
    throw new Error(
      `Overlap (${overlapTokens} tokens) must be less than chunk size (${tokensPerChunk} tokens)`
    );
  }

  // First pass: collect raw text chunks
  const rawChunks: string[] = [];
  for (let i = 0; i < words.length; i += stepSize) {
    const chunkWords = words.slice(i, i + chunkSizeWords);
    rawChunks.push(chunkWords.join(" "));
  }

  // Second pass: attach metadata
  const totalChunks = rawChunks.length;

  return rawChunks.map((chunkText, index) => ({
    text: chunkText,
    metadata: {
      meetingId,
      meetingTitle,
      sourceFile,
      chunkIndex: index,
      globalChunkIndex: globalChunkOffset + index,
      totalChunks,
      createdAt: new Date().toISOString(),
    },
  }));
}
