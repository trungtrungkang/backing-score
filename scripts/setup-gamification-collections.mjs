import { Client, Databases, Permission, Role } from "node-appwrite";
import { config } from "dotenv";

config({ path: ".env.local" });

// --- Configuration ---
const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

// Required environment variables check
if (!PROJECT_ID || !API_KEY) {
  console.error("Missing required environment variables:");
  console.error("  NEXT_PUBLIC_APPWRITE_PROJECT_ID:", PROJECT_ID ? "✓" : "✗");
  console.error("  APPWRITE_API_KEY:", API_KEY ? "✓" : "✗");
  process.exit(1);
}

// Ensure database ID is provided or fallback
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";

const client = new Client();
client
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

// Default Roles
const roleAny = Role.any();
const roleUsers = Role.users();

async function safeCreate(name, promiseFn) {
  try {
    await promiseFn();
    console.log(`✅ Created ${name}`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`⚠️ ${name} already exists`);
    } else {
      console.error(`❌ Failed to create ${name}:`, err.message);
    }
  }
}

async function createSchema() {
  console.log(`Setting up Gamification in database: ${DATABASE_ID}\n`);

  // ============================================
  // 1. PRACTICE SESSIONS COLLECTION
  // ============================================
  console.log("Setting up 'practice_sessions' collection...");
  await safeCreate("'practice_sessions' collection", () => databases.createCollection(
      DATABASE_ID, "practice_sessions", "practice_sessions", [
        Permission.read(roleUsers),
        Permission.create(roleUsers),
        Permission.update(Role.label("admin")),
        Permission.delete(Role.label("admin"))
      ]
  ));

  // Attributes
  await safeCreate("Attribute: userId", () => databases.createStringAttribute(DATABASE_ID, "practice_sessions", "userId", 36, true));
  await safeCreate("Attribute: projectId", () => databases.createStringAttribute(DATABASE_ID, "practice_sessions", "projectId", 36, true));
  await safeCreate("Attribute: startedAt", () => databases.createDatetimeAttribute(DATABASE_ID, "practice_sessions", "startedAt", true));
  await safeCreate("Attribute: durationMs", () => databases.createIntegerAttribute(DATABASE_ID, "practice_sessions", "durationMs", true));
  await safeCreate("Attribute: maxSpeed", () => databases.createFloatAttribute(DATABASE_ID, "practice_sessions", "maxSpeed", false, 0, 2));
  await safeCreate("Attribute: waitModeScore", () => databases.createIntegerAttribute(DATABASE_ID, "practice_sessions", "waitModeScore", false, 0, 100));
  await safeCreate("Attribute: flowModeScore", () => databases.createIntegerAttribute(DATABASE_ID, "practice_sessions", "flowModeScore", false, 0, 100));
  await safeCreate("Attribute: inputType", () => databases.createStringAttribute(DATABASE_ID, "practice_sessions", "inputType", 10, false));
  await safeCreate("Attribute: completedAt", () => databases.createDatetimeAttribute(DATABASE_ID, "practice_sessions", "completedAt", true));

  // Indexes
  await safeCreate("Index: userId_idx", () => databases.createIndex(DATABASE_ID, "practice_sessions", "userId_idx", "key", ["userId"]));
  await safeCreate("Index: projectId_idx", () => databases.createIndex(DATABASE_ID, "practice_sessions", "projectId_idx", "key", ["projectId"]));

  // ============================================
  // 2. USER STATS COLLECTION
  // ============================================
  console.log("\nSetting up 'user_stats' collection...");
  await safeCreate("'user_stats' collection", () => databases.createCollection(
      DATABASE_ID, "user_stats", "user_stats", [
        Permission.read(roleUsers),
        Permission.create(Role.label("admin")),
        Permission.update(Role.label("admin")),
        Permission.delete(Role.label("admin"))
      ]
  ));

  // Attributes
  await safeCreate("Attribute: userId", () => databases.createStringAttribute(DATABASE_ID, "user_stats", "userId", 36, true));
  await safeCreate("Attribute: totalXP", () => databases.createIntegerAttribute(DATABASE_ID, "user_stats", "totalXP", false, 0, 99999999, 0));
  await safeCreate("Attribute: level", () => databases.createIntegerAttribute(DATABASE_ID, "user_stats", "level", false, 1, 999, 1));
  await safeCreate("Attribute: currentStreak", () => databases.createIntegerAttribute(DATABASE_ID, "user_stats", "currentStreak", false, 0, 9999, 0));
  await safeCreate("Attribute: longestStreak", () => databases.createIntegerAttribute(DATABASE_ID, "user_stats", "longestStreak", false, 0, 9999, 0));
  await safeCreate("Attribute: lastPracticeDate", () => databases.createStringAttribute(DATABASE_ID, "user_stats", "lastPracticeDate", 10, false));
  await safeCreate("Attribute: totalPracticeMs", () => databases.createIntegerAttribute(DATABASE_ID, "user_stats", "totalPracticeMs", false, 0, 9999999999, 0));
  await safeCreate("Attribute: badges", () => databases.createStringAttribute(DATABASE_ID, "user_stats", "badges", 255, false, undefined, true));

  // Indexes
  await safeCreate("Index: userId_idx", () => databases.createIndex(DATABASE_ID, "user_stats", "userId_idx", "unique", ["userId"]));
  await safeCreate("Index: totalXP_idx", () => databases.createIndex(DATABASE_ID, "user_stats", "totalXP_idx", "key", ["totalXP"]));

  // ============================================
  // 3. PLATFORM CONFIGURATION COLLECTION
  // ============================================
  console.log("\nSetting up 'platform_config' collection...");
  await safeCreate("'platform_config' collection", () => databases.createCollection(
      DATABASE_ID, "platform_config", "platform_config", [
        Permission.read(roleAny),
        Permission.create(Role.label("admin")),
        Permission.update(Role.label("admin")),
        Permission.delete(Role.label("admin"))
      ]
  ));

  // Attributes
  await safeCreate("Attribute: key", () => databases.createStringAttribute(DATABASE_ID, "platform_config", "key", 50, true));
  await safeCreate("Attribute: value", () => databases.createStringAttribute(DATABASE_ID, "platform_config", "value", 10000, true));
  
  // Indexes
  await safeCreate("Index: key_idx", () => databases.createIndex(DATABASE_ID, "platform_config", "key_idx", "unique", ["key"]));
}

async function insertDefaultConfig() {
  console.log("\nSeeding default gamification configuration...");
  try {
    // Wait for attributes to be ready before inserting doc
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const configData = {
      levelThresholds: [0, 100, 500, 2000, 5000, 15000, 50000, 100000],
      xpPerMinute: 2,
      waitModeScore80Bonus: 25,
      waitModeScore100Bonus: 50,
      flowModeScore80Bonus: 50,
      flowModeScore100Bonus: 200,
      songCompleteBonus: 10,
      streakMultiplier: 5
    };

    try {
      await databases.createDocument(
        DATABASE_ID,
        "platform_config",
        "gamification_rules",
        {
           key: "gamification_rules",
           value: JSON.stringify(configData)
        }
      );
      console.log("✅ Seeded default gamification config");
    } catch (createErr) {
      if (createErr.code === 409) {
        console.log("⚠️ Default config document already exists. Attempting update...");
        await databases.updateDocument(
          DATABASE_ID,
          "platform_config",
          "gamification_rules",
          {
             value: JSON.stringify(configData)
          }
        );
        console.log("✅ Successfully updated default gamification config");
      } else {
        throw createErr;
      }
    }
  } catch (err) {
    console.error("❌ Failed to seed config:", err.message);
  }
}

async function main() {
  await createSchema();
  await insertDefaultConfig();
  console.log("\n✅ Gamification schema setup complete!");
}

main().catch(console.error);
