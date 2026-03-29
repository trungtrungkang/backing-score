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

async function createSchema() {
  console.log(`Setting up Gamification in database: ${DATABASE_ID}\n`);

  // ============================================
  // 1. PRACTICE SESSIONS COLLECTION
  // ============================================
  console.log("Setting up 'practice_sessions' collection...");
  try {
    await databases.createCollection(
      DATABASE_ID,
      "practice_sessions",
      "practice_sessions",
      [
        Permission.read(roleUsers), // User can see their own
        Permission.create(roleUsers), // Allow frontend to create but server can also create
        Permission.update(Role.team("admin", "owner")), // No updates allowed by users after complete
        Permission.delete(Role.team("admin", "owner"))
      ]
    );
    console.log("✅ Created 'practice_sessions' collection");

    // Attributes
    await databases.createStringAttribute(DATABASE_ID, "practice_sessions", "userId", 36, true);
    await databases.createStringAttribute(DATABASE_ID, "practice_sessions", "projectId", 36, true);
    await databases.createDatetimeAttribute(DATABASE_ID, "practice_sessions", "startedAt", true);
    await databases.createIntegerAttribute(DATABASE_ID, "practice_sessions", "durationMs", true); // Time played
    await databases.createFloatAttribute(DATABASE_ID, "practice_sessions", "maxSpeed", false, 0, 2); // 0.0 to 2.0 (Playback rate)
    await databases.createIntegerAttribute(DATABASE_ID, "practice_sessions", "waitModeScore", false, 0, 100);
    await databases.createDatetimeAttribute(DATABASE_ID, "practice_sessions", "completedAt", true);
    console.log("✅ Created attributes for 'practice_sessions'");

    // Indexes
    await databases.createIndex(DATABASE_ID, "practice_sessions", "userId_idx", "key", ["userId"]);
    await databases.createIndex(DATABASE_ID, "practice_sessions", "projectId_idx", "key", ["projectId"]);
    console.log("✅ Created indexes for 'practice_sessions'");
  } catch (err) {
    if (err.code === 409) {
      console.log("⚠️ 'practice_sessions' collection already exists");
    } else {
      console.error("❌ Failed to create 'practice_sessions' collection:", err.message);
    }
  }

  // ============================================
  // 2. USER STATS COLLECTION
  // ============================================
  console.log("\nSetting up 'user_stats' collection...");
  try {
    await databases.createCollection(
      DATABASE_ID,
      "user_stats",
      "user_stats",
      [
        Permission.read(roleUsers), // Users can read everything to see leaderboards
        // Creation, Modification, Deletion by Admin Only
        Permission.create(Role.team("admin", "owner")),
        Permission.update(Role.team("admin", "owner")),
        Permission.delete(Role.team("admin", "owner"))
      ]
    );
    console.log("✅ Created 'user_stats' collection");

    // Attributes
    await databases.createStringAttribute(DATABASE_ID, "user_stats", "userId", 36, true);
    await databases.createIntegerAttribute(DATABASE_ID, "user_stats", "totalXP", false, 0, 99999999, 0);
    await databases.createIntegerAttribute(DATABASE_ID, "user_stats", "level", false, 1, 999, 1);
    await databases.createIntegerAttribute(DATABASE_ID, "user_stats", "currentStreak", false, 0, 9999, 0);
    await databases.createIntegerAttribute(DATABASE_ID, "user_stats", "longestStreak", false, 0, 9999, 0);
    await databases.createStringAttribute(DATABASE_ID, "user_stats", "lastPracticeDate", 10, false); // YYYY-MM-DD
    await databases.createIntegerAttribute(DATABASE_ID, "user_stats", "totalPracticeMs", false, 0, 9999999999, 0);
    await databases.createStringAttribute(DATABASE_ID, "user_stats", "badges", 255, false, undefined, true); // Array of badges

    console.log("✅ Created attributes for 'user_stats'");

    // Indexes
    await databases.createIndex(DATABASE_ID, "user_stats", "userId_idx", "unique", ["userId"]);
    await databases.createIndex(DATABASE_ID, "user_stats", "totalXP_idx", "key", ["totalXP"]); // For leaderboards
    console.log("✅ Created indexes for 'user_stats'");
  } catch (err) {
    if (err.code === 409) {
      console.log("⚠️ 'user_stats' collection already exists");
    } else {
      console.error("❌ Failed to create 'user_stats' collection:", err.message);
    }
  }

  // ============================================
  // 3. PLATFORM CONFIGURATION COLLECTION
  // ============================================
  console.log("\nSetting up 'platform_config' collection...");
  try {
    await databases.createCollection(
      DATABASE_ID,
      "platform_config",
      "platform_config",
      [
        Permission.read(roleAny), // Anyone can read config 
        Permission.create(Role.team("admin", "owner")),
        Permission.update(Role.team("admin", "owner")),
        Permission.delete(Role.team("admin", "owner"))
      ]
    );
    console.log("✅ Created 'platform_config' collection");
    
    await databases.createStringAttribute(DATABASE_ID, "platform_config", "key", 50, true);
    await databases.createStringAttribute(DATABASE_ID, "platform_config", "value", 10000, true); // JSON stored
    console.log("✅ Created attributes for 'platform_config'");
    await databases.createIndex(DATABASE_ID, "platform_config", "key_idx", "unique", ["key"]);
    console.log("✅ Created indexes for 'platform_config'");
  } catch (err) {
    if (err.code === 409) {
      console.log("⚠️ 'platform_config' collection already exists");
    } else {
      console.error("❌ Failed to create 'platform_config' collection:", err.message);
    }
  }
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
      songCompleteBonus: 10,
      streakMultiplier: 5
    };

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
  } catch (err) {
    if (err.code === 409) {
        console.log("⚠️ Default config document already exists");
    } else {
        console.error("❌ Failed to seed config:", err.message);
    }
  }
}

async function main() {
  await createSchema();
  await insertDefaultConfig();
  console.log("\n✅ Gamification schema setup complete!");
}

main().catch(console.error);
