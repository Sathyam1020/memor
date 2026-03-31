import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { getQdrantClient, COLLECTION_NAME } from "../lib/qdrant.js";

async function main(): Promise<void> {
  // 1. Check Postgres meetings
  console.log("=== Postgres Meetings ===");
  const meetings = await prisma.meeting.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const m of meetings) {
    console.log(`  ${m.id} | "${m.title}" | ${m.status} | ${m.chunks} chunks | userId: ${m.userId}`);
  }

  // 2. Check Qdrant points
  console.log("\n=== Qdrant Points (last 10) ===");
  const qdrant = getQdrantClient();
  const scroll = await qdrant.scroll(COLLECTION_NAME, {
    limit: 10,
    with_payload: true,
    with_vector: false,
  });

  for (const point of scroll.points) {
    const p = point.payload as Record<string, unknown>;
    console.log(`  ID: ${point.id}`);
    console.log(`    meetingId: ${p.meetingId}`);
    console.log(`    userId: ${p.userId ?? "MISSING"}`);
    console.log(`    title: ${p.meetingTitle}`);
    console.log(`    chunk: ${p.chunkIndex}`);
    console.log();
  }

  await prisma.$disconnect();
}

main();
