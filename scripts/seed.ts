/**
 * One-off seed script to create your personal user account.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Notes:
 * - This runs outside of Next.js; to load .env.local you may need to copy it to
 *   .env or ensure environment variables are set. We load dotenv here to help.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import UserModel from "../src/models/User";

// Load .env.local first, then fall back to .env if needed.
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Edit these values before running the script
const NAME = "Abhishek Garg";
const EMAIL = "abhishekgarg959@gmail.com";
const PASSWORD = "Abhishek@2000";

// Set to true to update password if user exists
const SHOULD_UPDATE_IF_EXISTS = false;

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not defined. Copy .env.local to .env or set the variable.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const email = EMAIL.toLowerCase();
  const existing = await UserModel.findOne({ email }).exec();
  if (existing) {
    if (!SHOULD_UPDATE_IF_EXISTS) {
      console.log(`User with email ${email} already exists. Exiting.`);
      await mongoose.disconnect();
      process.exit(0);
    }
    const hash = await bcrypt.hash(PASSWORD, 10);
    existing.password = hash;
    existing.name = NAME;
    await existing.save();
    console.log(`Updated existing user ${email}`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  await UserModel.create({ name: NAME, email, password: hash });
  console.log(`Created user ${email}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
