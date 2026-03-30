import "dotenv/config";
import { chunkTranscript } from "../lib/chunker.js";
import { embedBatch } from "../lib/embeddings.js";
import { createCollection, upsertChunks, qdrantClient, COLLECTION_NAME } from "../lib/qdrant.js";

const sampleText = `
Sarah: Let's discuss the Q3 API redesign. Mike proposed migrating from REST to GraphQL.
Mike: We have 40 endpoints that could be consolidated into 15. Response times will improve by 40 percent.
Sarah: Timeline is 12 weeks including buffer. Mike will draft an RFC by Friday.
`;

async function main(): Promise<void> {
  // 1. Create collection
  console.log("\n--- Creating collection ---");
  await createCollection();

  // 2. Chunk the text
  console.log("\n--- Chunking ---");
  const chunks = chunkTranscript(sampleText, {
    meetingId: "test-001",
    meetingTitle: "Storage Test",
    sourceFile: "test.txt",
    tokensPerChunk: 100,
    overlapTokens: 20,
  });
  console.log(`Created ${chunks.length} chunks`);

  // 3. Embed all chunks in one batch
  console.log("\n--- Embedding ---");
  const texts = chunks.map((c) => c.text);
  const vectors = await embedBatch(texts);
  console.log(`Got ${vectors.length} vectors, each ${vectors[0].length} dimensions`);
  console.log(`First vector (first 5 values): [${vectors[0].slice(0, 5).map((v) => v.toFixed(6)).join(", ")}]`);

  // 4. Store in Qdrant
  console.log("\n--- Upserting to Qdrant ---");
  await upsertChunks(chunks, vectors);

  // 5. Verify — read back from Qdrant
  console.log("\n--- Verifying: reading points back ---");
  const collectionInfo = await qdrantClient.getCollection(COLLECTION_NAME);
  console.log(`Collection "${COLLECTION_NAME}" info:`);
  console.log(`  Points count: ${collectionInfo.points_count}`);
  console.log(`  Vectors size: ${collectionInfo.config.params.vectors}`);
  console.log(`  Status: ${collectionInfo.status}`);

  // 6. Scroll to see actual stored data
  console.log("\n--- Stored points (scroll) ---");
  const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
    limit: 10,
    with_payload: true,
    with_vector: false, // skip vectors to keep output readable
  });

  for (const point of scrollResult.points) {
    console.log(`\nPoint ID: ${point.id}`);
    console.log(`Payload:`, JSON.stringify(point.payload, null, 2));
  }

  console.log("\n✓ Storage test complete. Check your Qdrant Cloud dashboard to see the points.\n");
}

main();
