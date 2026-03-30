import "dotenv/config";
import { searchMeetings, askMeetings } from "../lib/rag.js";

async function main(): Promise<void> {
  // ============================================
  // TEST 1: Cross-meeting noise
  // ============================================
  console.log("=== TEST 1: Cross-meeting noise ===");
  console.log('Question: "What were the action items?"\n');

  console.log("--- All meetings (unfiltered) ---");
  const allResults = await searchMeetings("What were the action items?", 5);
  for (const r of allResults) {
    console.log(
      `  [${r.score.toFixed(4)}] ${r.meetingTitle} — chunk ${r.chunkIndex}: ${r.text.slice(0, 80)}...`
    );
  }

  console.log("\n--- Filtered to meeting-002 only ---");
  const filteredResults = await searchMeetings(
    "What were the action items?",
    5,
    "meeting-002"
  );
  for (const r of filteredResults) {
    console.log(
      `  [${r.score.toFixed(4)}] ${r.meetingTitle} — chunk ${r.chunkIndex}: ${r.text.slice(0, 80)}...`
    );
  }

  console.log(
    "\n^ Compare the scores. Unfiltered pulls chunks from BOTH meetings."
  );
  console.log(
    "  The Q3 Planning meeting has action items too (RFC, recruiter, migration tracker)."
  );
  console.log(
    "  Without filtering, the LLM might mix action items from different meetings.\n"
  );

  // ============================================
  // TEST 2: Question the meetings can't answer
  // ============================================
  console.log("\n=== TEST 2: Unanswerable question ===");
  console.log('Question: "What is the company\'s revenue for Q2?"\n');

  const { answer: unanswerableAnswer, sources: unanswerableSources } =
    await askMeetings("What is the company's revenue for Q2?");

  console.log("Answer:", unanswerableAnswer);
  console.log("\nTop source scores:");
  for (const s of unanswerableSources.slice(0, 3)) {
    console.log(`  [${s.score.toFixed(4)}] ${s.meetingTitle}`);
  }
  console.log(
    "\n^ The scores should be low (< 0.5). If the LLM still tries to answer,"
  );
  console.log(
    "  it's hallucinating — our system prompt should prevent this.\n"
  );

  // ============================================
  // TEST 3: Ambiguous question
  // ============================================
  console.log("\n=== TEST 3: Ambiguous question ===");
  console.log('Question: "What was the timeline?"\n');

  const { answer: ambiguousAnswer, sources: ambiguousSources } =
    await askMeetings("What was the timeline?");

  console.log("Answer:", ambiguousAnswer);
  console.log("\nSources used:");
  for (const s of ambiguousSources.slice(0, 3)) {
    console.log(
      `  [${s.score.toFixed(4)}] ${s.meetingTitle} — chunk ${s.chunkIndex}`
    );
  }
  console.log(
    '\n^ "Timeline" appears in both meetings (API migration: 12 weeks,'
  );
  console.log(
    "  outage: 93 min timeline). The LLM might conflate them or pick one.\n"
  );

  // ============================================
  // TEST 4: Deduplication check
  // ============================================
  console.log("\n=== TEST 4: Near-duplicate detection ===\n");

  const allChunks = await searchMeetings("meeting", 10);
  let dupeCount = 0;

  for (let i = 0; i < allChunks.length; i++) {
    for (let j = i + 1; j < allChunks.length; j++) {
      // Compare chunks by searching one chunk's text against the other
      const chunkA = allChunks[i];
      const chunkB = allChunks[j];

      // Use Qdrant to get similarity between two chunks
      const results = await searchMeetings(chunkA.text, 10);
      const match = results.find(
        (r) =>
          r.meetingId === chunkB.meetingId &&
          r.chunkIndex === chunkB.chunkIndex
      );

      if (match && match.score > 0.98) {
        dupeCount++;
        console.log(
          `  DUPLICATE: ${chunkA.meetingTitle} chunk ${chunkA.chunkIndex} ↔ ${chunkB.meetingTitle} chunk ${chunkB.chunkIndex} (score: ${match.score.toFixed(4)})`
        );
      }
    }
  }

  if (dupeCount === 0) {
    console.log("  No near-duplicates found (threshold: 0.98 cosine similarity).");
    console.log(
      "  This is expected — our two sample meetings have different topics."
    );
    console.log(
      "  Duplicates would appear with multi-file meetings where recordings overlap.\n"
    );
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n=== RAG FAILURE MODES SUMMARY ===\n");
  console.log("1. CROSS-MEETING NOISE: Without meetingId filter, action items");
  console.log("   from different meetings get mixed. Fix: always filter when");
  console.log("   the user is asking about a specific meeting.\n");
  console.log("2. HALLUCINATION RISK: Low-scoring chunks still get sent to the");
  console.log("   LLM as context. Fix: add a minimum score threshold (e.g. 0.3)");
  console.log("   and exclude weak matches from the prompt.\n");
  console.log("3. AMBIGUITY: Generic questions like 'What was the timeline?'");
  console.log("   retrieve from multiple meetings. Fix: the UI should prompt");
  console.log("   users to select a meeting, or the answer should clearly");
  console.log("   separate results by meeting.\n");
  console.log("4. CHUNK BOUNDARY SPLITS: If a key decision spans two chunks,");
  console.log("   neither chunk alone has the full context. Our 50-token overlap");
  console.log("   mitigates this but doesn't eliminate it. Fix: increase overlap");
  console.log("   or use sentence-aware chunking.\n");
  console.log("5. NEAR-DUPLICATES: Multi-file meetings (e.g. two recordings");
  console.log("   of the same call) can produce overlapping chunks. These waste");
  console.log("   embedding cost and retrieval slots. Fix: deduplicate during");
  console.log("   ingestion by checking cosine similarity against existing chunks.\n");
}

main();
