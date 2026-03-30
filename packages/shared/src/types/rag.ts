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
