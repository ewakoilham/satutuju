import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CURRICULUM = [
  { sessionNum: 1, phase: "discovery", topic: "Introduction & Mentee Profiling" },
  { sessionNum: 2, phase: "discovery", topic: "Gap Analysis & Readiness Assessment" },
  { sessionNum: 3, phase: "planning", topic: "University Shortlisting" },
  { sessionNum: 4, phase: "planning", topic: "Application Strategy & Timeline" },
  { sessionNum: 5, phase: "writing", topic: "Motivation Letter — Brainstorm & Outline" },
  { sessionNum: 6, phase: "writing", topic: "Motivation Letter — Review & Revision" },
  { sessionNum: 7, phase: "writing", topic: "Academic CV & Supporting Documents" },
  { sessionNum: 8, phase: "execution", topic: "Mock Interview & Preparation" },
  { sessionNum: 9, phase: "execution", topic: "Final Document Review & Audit" },
  { sessionNum: 10, phase: "closing", topic: "Evaluation & Closing" },
];

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@satutuju.id" },
    update: {},
    create: { email: "admin@satutuju.id", password, name: "Admin SatuTuju", role: "admin" },
  });

  const mentor1 = await prisma.user.upsert({
    where: { email: "mentor1@satutuju.id" },
    update: {},
    create: { email: "mentor1@satutuju.id", password, name: "Rina Wijaya", role: "mentor" },
  });

  const mentor2 = await prisma.user.upsert({
    where: { email: "mentor2@satutuju.id" },
    update: {},
    create: { email: "mentor2@satutuju.id", password, name: "Budi Santoso", role: "mentor" },
  });

  const mentee1 = await prisma.user.upsert({
    where: { email: "mentee1@satutuju.id" },
    update: {},
    create: { email: "mentee1@satutuju.id", password, name: "Ayu Pratiwi", role: "mentee" },
  });

  const mentee2 = await prisma.user.upsert({
    where: { email: "mentee2@satutuju.id" },
    update: {},
    create: { email: "mentee2@satutuju.id", password, name: "Dimas Kurniawan", role: "mentee" },
  });

  const pairing1 = await prisma.pairing.upsert({
    where: { mentorId_menteeId: { mentorId: mentor1.id, menteeId: mentee1.id } },
    update: {},
    create: {
      mentorId: mentor1.id,
      menteeId: mentee1.id,
      targetProgram: "MSc Education, University of Edinburgh",
      ieltsScore: "6.5",
    },
  });

  const pairing2 = await prisma.pairing.upsert({
    where: { mentorId_menteeId: { mentorId: mentor2.id, menteeId: mentee2.id } },
    update: {},
    create: {
      mentorId: mentor2.id,
      menteeId: mentee2.id,
      targetProgram: "MA International Relations, University of Melbourne",
      ieltsScore: "7.0",
    },
  });

  for (const pairing of [pairing1, pairing2]) {
    const existingSessions = await prisma.session.count({
      where: { pairingId: pairing.id },
    });
    if (existingSessions === 0) {
      await prisma.session.createMany({
        data: CURRICULUM.map((s) => ({
          pairingId: pairing.id,
          sessionNum: s.sessionNum,
          phase: s.phase,
          topic: s.topic,
          status: "upcoming",
        })),
      });
    }
  }

  await prisma.session.updateMany({
    where: { pairingId: pairing1.id, sessionNum: { in: [1, 2] } },
    data: { status: "completed", completedAt: new Date(), mentorRating: 4, menteeEnergy: 4, keyOutput: "Profil mentee terdokumentasi lengkap" },
  });

  await prisma.session.updateMany({
    where: { pairingId: pairing1.id, sessionNum: 1 },
    data: { summaryNotes: "Great first session! Ayu has a strong background in education and a clear motivation for pursuing her Master's." },
  });

  await prisma.task.createMany({
    data: [
      { pairingId: pairing1.id, sessionNum: 2, title: "Research 5 dream universities with reasons", description: "List your top 5 universities and explain why each one appeals to you.", assignedBy: mentor1.id, status: "completed", completedAt: new Date() },
      { pairingId: pairing1.id, sessionNum: 3, title: "Confirm budget and financing options", assignedBy: mentor1.id, status: "pending" },
      { pairingId: pairing1.id, sessionNum: 3, title: "Submit draft CV for review", description: "Upload your latest CV to the platform before our next session.", assignedBy: mentor1.id, status: "pending" },
    ],
  });

  await prisma.notification.create({
    data: { userId: mentee1.id, title: "Welcome to SatuTuju!", message: "You've been paired with Rina Wijaya as your mentor. Your journey starts now!", type: "info", link: "/dashboard" },
  });

  console.log("Seed complete!");
  console.log("\nTest accounts (password: password123):");
  console.log("  Admin:  admin@satutuju.id");
  console.log("  Mentor: mentor1@satutuju.id / mentor2@satutuju.id");
  console.log("  Mentee: mentee1@satutuju.id / mentee2@satutuju.id");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
