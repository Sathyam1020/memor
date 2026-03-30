import "dotenv/config";
import fs from "node:fs";
import { Command } from "commander";
import { ingestTranscript } from "../lib/ingest.js";

const program = new Command();

program
  .requiredOption("--file <path>", "Path to .txt transcript file")
  .requiredOption("--title <title>", "Human-readable meeting title")
  .requiredOption("--id <meetingId>", "Unique meeting identifier")
  .option(
    "--offset <number>",
    "Global chunk offset (for multi-file meetings)",
    "0"
  )
  .parse();

const opts = program.opts<{
  file: string;
  title: string;
  id: string;
  offset: string;
}>();

async function main(): Promise<void> {
  if (!fs.existsSync(opts.file)) {
    console.error(`File not found: ${opts.file}`);
    process.exit(1);
  }

  const text = fs.readFileSync(opts.file, "utf-8");

  if (text.trim().length === 0) {
    console.error("File is empty.");
    process.exit(1);
  }

  console.log(`\nIngesting: ${opts.file}`);
  console.log(`Meeting: "${opts.title}" (${opts.id})`);
  console.log(`File size: ${text.length} characters\n`);

  const result = await ingestTranscript(text, {
    meetingId: opts.id,
    meetingTitle: opts.title,
    sourceFile: opts.file,
    globalChunkOffset: parseInt(opts.offset, 10),
  });

  console.log(`\nDone. ${result.chunksIngested} chunks stored in Qdrant.`);
}

main();
