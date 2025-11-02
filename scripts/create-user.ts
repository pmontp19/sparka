#!/usr/bin/env tsx

/**
 * Script to manually create users with email/password authentication
 *
 * Usage:
 *   bun run scripts/create-user.ts
 *
 * Or with environment variables:
 *   USER_EMAIL=user@example.com USER_PASSWORD=password USER_NAME="User Name" bun run scripts/create-user.ts
 *
 * Or via API:
 *   API_URL=http://localhost:3000 bun run scripts/create-user.ts
 */

// Load .env file
import "dotenv/config";

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Get admin secret directly from env (avoid validating all project env vars)
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET environment variable is required");
  console.error("Add it to your .env file or set it in your environment");
  process.exit(1);
}

async function createUser(email: string, password: string, name: string) {
  try {
    console.log("Creating user...");

    const apiUrl = process.env.API_URL || "http://localhost:3000";
    const response = await fetch(`${apiUrl}/api/admin/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": ADMIN_SECRET as string,
      },
      body: JSON.stringify({ email, password, name }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      console.error("❌ Error creating user:", result.error);
      process.exit(1);
    }

    console.log("✅ User created successfully!");
    console.log("Email:", result.user.email);
    console.log("Name:", result.user.name);
    console.log("User ID:", result.user.id);
  } catch (error) {
    console.error("❌ Failed to create user:", error);
    process.exit(1);
  }
}

async function main() {
  // Check for environment variables first
  const envEmail = process.env.USER_EMAIL;
  const envPassword = process.env.USER_PASSWORD;
  const envName = process.env.USER_NAME;

  if (envEmail && envPassword && envName) {
    await createUser(envEmail, envPassword, envName);
    return;
  }

  // Interactive mode
  const rl = readline.createInterface({ input, output });

  try {
    console.log("=== Create New User ===\n");

    const email = await rl.question("Email: ");
    if (!email || !email.includes("@")) {
      console.error("❌ Invalid email address");
      process.exit(1);
    }

    const name = await rl.question("Name: ");
    if (!name) {
      console.error("❌ Name is required");
      process.exit(1);
    }

    const password = await rl.question("Password: ");
    if (!password || password.length < 8) {
      console.error("❌ Password must be at least 8 characters");
      process.exit(1);
    }

    rl.close();

    await createUser(email, password, name);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
