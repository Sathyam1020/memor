import "dotenv/config";
import { getQdrantClient } from "../lib/qdrant.js";
import { embedText } from "../lib/embeddings.js";

async function main(): Promise<void> {
  const meetingId = "cmne6qqzc00028xxvsmu4q071";
  const userId = "user_3BhE30lyrQNU3HcmbcNdYGlxOGr";
  const query = "what is this meeting about";

  console.log(`Query: "${query}"`);
  console.log(`meetingId: ${meetingId}`);
  console.log(`userId: ${userId}\n`);

  const vector = await embedText(query);

  const qdrant = getQdrantClient();

  // Search WITH userId filter
  console.log("=== With userId + meetingId filter ===");
  const withFilter = await qdrant.search("meetings", {
    vector,
    limit: 5,
    with_payload: true,
    filter: {
      must: [
        { key: "userId", match: { value: userId } },
        { key: "meetingId", match: { value: meetingId } },
      ],
    },
  });
  console.log(`Results: ${withFilter.length}`);
  for (const r of withFilter) {
    const p = r.payload as Record<string, unknown>;
    console.log(`  score: ${r.score.toFixed(4)} | chunk: ${p.chunkIndex} | userId: ${p.userId}`);
  }

  // Search WITHOUT userId filter (just meetingId)
  console.log("\n=== With meetingId only (no userId filter) ===");
  const noUserFilter = await qdrant.search("meetings", {
    vector,
    limit: 5,
    with_payload: true,
    filter: {
      must: [
        { key: "meetingId", match: { value: meetingId } },
      ],
    },
  });
  console.log(`Results: ${noUserFilter.length}`);
  for (const r of noUserFilter) {
    const p = r.payload as Record<string, unknown>;
    console.log(`  score: ${r.score.toFixed(4)} | chunk: ${p.chunkIndex} | userId: ${p.userId}`);
  }
}

main();
