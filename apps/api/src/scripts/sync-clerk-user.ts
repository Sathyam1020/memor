/**
 * One-time script to manually sync a Clerk user to Postgres.
 * Use this during development when the webhook isn't set up yet.
 *
 * Usage: pnpm tsx src/scripts/sync-clerk-user.ts --clerk-secret <key>
 *
 * Gets the first user from Clerk and creates/updates them in Postgres.
 */
import "dotenv/config";
import { Command } from "commander";
import { prisma } from "../lib/prisma.js";

const program = new Command();
program
  .requiredOption("--clerk-secret <key>", "Clerk secret key (sk_test_...)")
  .parse();

const opts = program.opts<{ clerkSecret: string }>();

async function main(): Promise<void> {
  // Fetch users from Clerk API
  const response = await fetch("https://api.clerk.com/v1/users?limit=10", {
    headers: { Authorization: `Bearer ${opts.clerkSecret}` },
  });

  if (!response.ok) {
    throw new Error(
      `Clerk API error: ${response.status} ${await response.text()}`,
    );
  }

  const users = (await response.json()) as Array<{
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
  }>;

  if (users.length === 0) {
    console.log("No users found in Clerk.");
    return;
  }

  for (const user of users) {
    const primaryEmail = user.email_addresses.find(
      (e) => e.id === user.primary_email_address_id,
    );

    if (!primaryEmail) {
      console.log(`Skipping ${user.id} — no primary email`);
      continue;
    }

    const name =
      [user.first_name, user.last_name].filter(Boolean).join(" ") || null;

    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: primaryEmail.email_address, name },
      create: { id: user.id, email: primaryEmail.email_address, name },
    });

    console.log(`Synced: ${user.id} (${primaryEmail.email_address})`);
  }

  await prisma.$disconnect();
  console.log("✓ Done.");
}

main();
