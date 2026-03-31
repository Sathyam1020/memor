import "dotenv/config";
import { getQdrantClient } from "../lib/qdrant.js";

async function main(): Promise<void> {
  const qdrant = getQdrantClient();
  const meetingId = process.argv[2];

  if (!meetingId) {
    console.log("Usage: pnpm tsx src/scripts/debug-chunks.ts <meetingId>");
    process.exit(1);
  }

  const result = await qdrant.scroll("meetings", {
    limit: 10,
    with_payload: true,
    with_vector: false,
    filter: { must: [{ key: "meetingId", match: { value: meetingId } }] },
  });

  console.log(`Found ${result.points.length} chunks for meetingId: ${meetingId}\n`);

  for (const p of result.points) {
    const payload = p.payload as Record<string, unknown>;
    console.log(`--- Chunk ${payload.chunkIndex} ---`);
    console.log(`userId: ${payload.userId ?? "MISSING"}`);
    console.log(`text: ${String(payload.text).slice(0, 200)}...`);
    console.log();
  }
}

main();
