import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function main(): Promise<void> {
  const userCount = await prisma.user.count();
  const meetingCount = await prisma.meeting.count();
  const sourceCount = await prisma.meetingSource.count();

  console.log("Tables verified:");
  console.log(`  Users: ${userCount}`);
  console.log(`  Meetings: ${meetingCount}`);
  console.log(`  MeetingSources: ${sourceCount}`);
  console.log("✓ Prisma connected and all tables exist.");

  await prisma.$disconnect();
}

main();
