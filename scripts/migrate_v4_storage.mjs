import { Client, Databases, Query, ID } from "node-appwrite";
import "dotenv/config";

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "backing_score_db";
const SHEET_COL = "sheet_music";
const PROJ_COL = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || "projects";

// New collections
const ASSETS_COL = "v4_drive_assets";
const FOLDERS_COL = "v4_drive_folders";

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initCollections() {
    console.log("1. Initializing V4 Drive Collections...");
    try {
        await db.createCollection(DB_ID, ASSETS_COL, "V4 Drive Assets");
        console.log(`- Created UI Collection: ${ASSETS_COL}`);
        await db.createStringAttribute(DB_ID, ASSETS_COL, "userId", 100, true);
        await db.createStringAttribute(DB_ID, ASSETS_COL, "originalName", 255, true);
        await db.createIntegerAttribute(DB_ID, ASSETS_COL, "sizeBytes", true);
        await db.createStringAttribute(DB_ID, ASSETS_COL, "contentType", 100, false);
        await db.createStringAttribute(DB_ID, ASSETS_COL, "folderId", 100, false);
        await db.createStringAttribute(DB_ID, ASSETS_COL, "r2Key", 255, true);
        await db.createIntegerAttribute(DB_ID, ASSETS_COL, "usedCount", false, 0); // Reference count
        console.log(`- Created Attributes for ${ASSETS_COL}. (Note: Appwrite takes a few seconds to index them)`);
    } catch (e) {
        if (e.code === 409) console.log(`- ${ASSETS_COL} already exists`);
        else throw e;
    }

    try {
        await db.createCollection(DB_ID, FOLDERS_COL, "V4 Drive Folders");
        console.log(`- Created UI Collection: ${FOLDERS_COL}`);
        await db.createStringAttribute(DB_ID, FOLDERS_COL, "userId", 100, true);
        await db.createStringAttribute(DB_ID, FOLDERS_COL, "name", 255, true);
        await db.createStringAttribute(DB_ID, FOLDERS_COL, "parentId", 100, false);
        console.log(`- Created Attributes for ${FOLDERS_COL}.`);
    } catch (e) {
        if (e.code === 409) console.log(`- ${FOLDERS_COL} already exists`);
        else throw e;
    }
}

async function migrateSheetsToProjects() {
    console.log("\n2. Migrating Sheet Music (PDF) to Projects...");
    const sheets = await db.listDocuments(DB_ID, SHEET_COL, [Query.limit(100)]);
    console.log(`Found ${sheets.documents.length} PDF Sheets to migrate.`);

    for (const sheet of sheets.documents) {
        console.log(`- Processing Sheet: [${sheet.$id}] ${sheet.title}...`);

        // Check if already migrated
        const existing = await db.listDocuments(DB_ID, PROJ_COL, [
            Query.equal("name", sheet.title),
            Query.limit(1)
        ]);
        
        let newProjectId;
        
        if (existing.documents.length > 0) {
            newProjectId = existing.documents[0].$id;
            console.log(`  -> Already migrated to Project: ${newProjectId}`);
        } else {
            // Build Universal Payload
            const payload = {
                version: 2,
                type: "multi-stems",
                metadata: {
                    name: sheet.title,
                    syncToTimemap: true,
                    tempo: 120
                },
                audioTracks: [], // PDF can have audio tracks appended to it later
                notationData: {
                    type: "pdf",
                    fileId: sheet.fileId,
                    pageCount: sheet.pageCount || 1,
                    thumbnailId: sheet.thumbnailId || null,
                    navMap: sheet.navMap || null,
                    timemap: []
                }
            };

            const newProject = await db.createDocument(
                DB_ID,
                PROJ_COL,
                ID.unique(),
                {
                    userId: sheet.userId,
                    name: sheet.title,
                    mode: "practice",
                    payload: JSON.stringify(payload),
                    payloadVersion: 2,
                    published: sheet.favorite || false, // Mapping feature toggle
                    tags: sheet.tags || [],
                    instruments: sheet.instrument ? [sheet.instrument] : []
                }
            );
            newProjectId = newProject.$id;
            console.log(`  -> Created Project: ${newProjectId}`);
        }

        // Migrate Referencing Entity: Favorite (targetType: "sheet_music" -> "project")
        try {
            const favs = await db.listDocuments(DB_ID, "favorites", [
                Query.equal("targetType", "sheet_music"),
                Query.equal("targetId", sheet.$id)
            ]);
            for (const f of favs.documents) {
                await db.updateDocument(DB_ID, "favorites", f.$id, {
                    targetType: "project",
                    targetId: newProjectId
                });
                console.log(`     - Updated Favorite: ${f.$id}`);
            }
        } catch (e) {
            console.log(`     - No favorites mapping available or failed to link (${e.message})`);
        }

        // Add additional migrations (assignment/post/etc) here if needed.
    }
}

async function run() {
    try {
        await initCollections();
        await sleep(2000); // Wait for attributes to be provisioned
        await migrateSheetsToProjects();
        console.log("\n✅ Migration Completed Succesfully!");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

run();
