import "dotenv/config";
import { Command } from "commander";
import { searchMeetings, askMeetings } from "../lib/rag.js";

const program = new Command();

program
  .requiredOption("--question <text>", "Question to ask about meetings")
  .option("--meeting <meetingId>", "Filter to a specific meeting")
  .option("--top-k <number>", "Number of chunks to retrieve", "5")
  .option("--search-only", "Only search, don't generate an answer")
  .parse();

const opts = program.opts<{
  question: string;
  meeting?: string;
  topK: string;
  searchOnly?: boolean;
}>();

async function main(): Promise<void> {
  const topK = parseInt(opts.topK, 10);

  console.log(`\nQuestion: "${opts.question}"`);
  if (opts.meeting) {
    console.log(`Filtering to meeting: ${opts.meeting}`);
  }
  console.log();

  if (opts.searchOnly) {
    // Search-only mode: show raw retrieval results
    console.log("--- Search Results ---\n");
    const results = await searchMeetings(opts.question, topK, opts.meeting);

    if (results.length === 0) {
      console.log("No results found.");
      return;
    }

    for (const result of results) {
      console.log(`Score: ${result.score.toFixed(4)}`);
      console.log(`Meeting: "${result.meetingTitle}" (${result.meetingId})`);
      console.log(`Source: ${result.sourceFile}, Chunk ${result.chunkIndex}`);
      console.log(`Text: ${result.text.slice(0, 200)}...`);
      console.log();
    }
  } else {
    // Full RAG mode
    const { answer, sources } = await askMeetings(opts.question, opts.meeting, topK);

    console.log("--- Answer ---\n");
    console.log(answer);

    console.log("\n--- Sources Used ---\n");
    for (const source of sources) {
      console.log(`  [Score ${source.score.toFixed(4)}] "${source.meetingTitle}" (${source.meetingId}), Chunk ${source.chunkIndex}`);
      console.log(`  File: ${source.sourceFile}`);
      console.log(`  Preview: ${source.text.slice(0, 120)}...`);
      console.log();
    }
  }
}

main();
