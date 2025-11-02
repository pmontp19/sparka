#!/usr/bin/env tsx

/**
 * Script to create multiple users in batch with auto-generated passwords
 *
 * Usage:
 *   bun run scripts/batch-create-users.ts
 *
 * Or with environment variables:
 *   BASE_NAME=user START_NUMBER=1 USER_COUNT=10 EMAIL_DOMAIN=example.com bun run scripts/batch-create-users.ts
 *
 * Or for production:
 *   API_URL=https://your-domain.com bun run scripts/batch-create-users.ts
 */

import { env } from "@/lib/env";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomBytes } from "node:crypto";

interface UserCredentials {
  number: number;
  email: string;
  name: string;
  password: string;
  userId?: string;
  success: boolean;
  error?: string;
}

function generateSecurePassword(length = 16): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  let password = "";
  for (const byte of bytes) {
    password += chars[byte % chars.length];
  }
  return password;
}

async function createUser(
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const apiUrl = process.env.API_URL || "http://localhost:3000";
    const response = await fetch(`${apiUrl}/api/admin/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": env.ADMIN_SECRET,
      },
      body: JSON.stringify({ email, password, name }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, userId: result.user.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function batchCreateUsers(
  baseName: string,
  startNumber: number,
  count: number,
  emailDomain: string
): Promise<UserCredentials[]> {
  const users: UserCredentials[] = [];

  console.log(`\n🚀 Creating ${count} users...\n`);

  for (let i = 0; i < count; i++) {
    const number = startNumber + i;
    const username = `${baseName}${number}`;
    const email = `${username}@${emailDomain}`;
    const name = `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} ${number}`;
    const password = generateSecurePassword();

    process.stdout.write(`Creating ${username}... `);

    const result = await createUser(email, password, name);

    users.push({
      number,
      email,
      name,
      password,
      userId: result.userId,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      console.log("✅");
    } else {
      console.log(`❌ ${result.error}`);
    }
  }

  return users;
}

function printUserTable(users: UserCredentials[]) {
  const successful = users.filter((u) => u.success);
  const failed = users.filter((u) => !u.success);

  console.log("\n" + "=".repeat(80));
  console.log("📊 BATCH USER CREATION RESULTS");
  console.log("=".repeat(80));
  console.log(`Total: ${users.length} | Success: ${successful.length} | Failed: ${failed.length}`);
  console.log("=".repeat(80));

  if (successful.length > 0) {
    console.log("\n✅ Successfully Created Users:\n");
    console.log(
      "No.".padEnd(6) +
        "Email".padEnd(30) +
        "Name".padEnd(20) +
        "Password".padEnd(20)
    );
    console.log("-".repeat(80));

    for (const user of successful) {
      console.log(
        String(user.number).padEnd(6) +
          user.email.padEnd(30) +
          user.name.padEnd(20) +
          user.password
      );
    }
  }

  if (failed.length > 0) {
    console.log("\n❌ Failed Users:\n");
    console.log("No.".padEnd(6) + "Email".padEnd(30) + "Error".padEnd(40));
    console.log("-".repeat(80));

    for (const user of failed) {
      console.log(
        String(user.number).padEnd(6) +
          user.email.padEnd(30) +
          (user.error || "Unknown error")
      );
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("⚠️  IMPORTANT: Save these credentials securely!");
  console.log("=".repeat(80) + "\n");
}

async function main() {
  // Check for environment variables first
  const envBaseName = process.env.BASE_NAME;
  const envStartNumber = process.env.START_NUMBER;
  const envUserCount = process.env.USER_COUNT;
  const envEmailDomain = process.env.EMAIL_DOMAIN;

  if (envBaseName && envStartNumber && envUserCount && envEmailDomain) {
    const users = await batchCreateUsers(
      envBaseName,
      Number.parseInt(envStartNumber, 10),
      Number.parseInt(envUserCount, 10),
      envEmailDomain
    );
    printUserTable(users);
    return;
  }

  // Interactive mode
  const rl = readline.createInterface({ input, output });

  try {
    console.log("=== Batch Create Users ===\n");

    const baseName = await rl.question("Base username (e.g., 'user'): ");
    if (!baseName) {
      console.error("❌ Base username is required");
      process.exit(1);
    }

    const startNumberStr = await rl.question(
      "Starting number (e.g., '1'): "
    );
    const startNumber = Number.parseInt(startNumberStr, 10);
    if (Number.isNaN(startNumber) || startNumber < 0) {
      console.error("❌ Invalid starting number");
      process.exit(1);
    }

    const countStr = await rl.question("Number of users to create: ");
    const count = Number.parseInt(countStr, 10);
    if (Number.isNaN(count) || count < 1 || count > 100) {
      console.error("❌ Count must be between 1 and 100");
      process.exit(1);
    }

    const emailDomain = await rl.question(
      "Email domain (e.g., 'example.com'): "
    );
    if (!emailDomain || !emailDomain.includes(".")) {
      console.error("❌ Valid email domain is required");
      process.exit(1);
    }

    rl.close();

    const users = await batchCreateUsers(baseName, startNumber, count, emailDomain);
    printUserTable(users);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
