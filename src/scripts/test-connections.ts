import "dotenv/config";
import OpenAI from "openai";
import { qdrantClient } from "../lib/qdrant.js";

async function testOpenAI(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Get it from https://platform.openai.com/api-keys"
    );
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: "test connection",
  });

  const vector = response.data[0].embedding;
  console.log(`  Model: text-embedding-3-small`);
  console.log(`  Vector dimensions: ${vector.length}`);
  console.log(`  First 5 values: [${vector.slice(0, 5).map((v) => v.toFixed(6)).join(", ")}]`);
  console.log(`  Tokens used: ${response.usage.total_tokens}`);
}

async function testQdrant(): Promise<void> {
  const response = await qdrantClient.getCollections();

  console.log(`  Collections found: ${response.collections.length}`);
  if (response.collections.length > 0) {
    console.log(
      `  Names: ${response.collections.map((c) => c.name).join(", ")}`
    );
  }
}

async function main(): Promise<void> {
  let failed = false;

  console.log("\n--- Testing OpenAI ---");
  try {
    await testOpenAI();
    console.log("  ✓ OpenAI connected\n");
  } catch (error) {
    failed = true;
    console.error(
      `  ✗ OpenAI failed: ${error instanceof Error ? error.message : error}\n`
    );
  }

  console.log("--- Testing Qdrant ---");
  try {
    await testQdrant();
    console.log("  ✓ Qdrant connected\n");
  } catch (error) {
    failed = true;
    console.error(
      `  ✗ Qdrant failed: ${error instanceof Error ? error.message : error}\n`
    );
  }

  if (failed) {
    console.log("✗ One or more connections failed. Fix the errors above.\n");
    process.exit(1);
  }

  console.log("✓ All systems ready.\n");
}

main();
