import { Client, Databases, Permission, Role, ID } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'backing_score_db';
const COLLECTION_ID = 'setlists';

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error("Missing Appwrite credentials in environment variables.");
  process.exit(1);
}

const client = new Client();
client
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

async function createSetlistsCollection() {
    try {
        console.log(`Checking if collection '${COLLECTION_ID}' exists...`);
        try {
            await databases.getCollection(DATABASE_ID, COLLECTION_ID);
            console.log(`Collection '${COLLECTION_ID}' already exists. Deleting it to recreate with latest schema...`);
            await databases.deleteCollection(DATABASE_ID, COLLECTION_ID);
            console.log(`Deleted old '${COLLECTION_ID}' collection.`);
        } catch (error) {
            if (error.code !== 404) {
                throw error;
            }
            console.log(`Collection '${COLLECTION_ID}' not found, creating new...`);
        }

        await databases.createCollection(
            DATABASE_ID,
            COLLECTION_ID,
            "Setlists",
            [
              Permission.create(Role.users()),
              Permission.read(Role.any()),
            ],
            true // documentSecurity: true
        );
        console.log(`Collection '${COLLECTION_ID}' created successfully.`);

        console.log("Adding attributes...");
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'userId', 36, true);
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'name', 255, true);
        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'items', 65535, true); 

        // Wait for attributes to become available
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        let ready = false;
        while (!ready) {
            console.log("Waiting for attributes to be ready...");
            await sleep(2000);
            const coll = await databases.getCollection(DATABASE_ID, COLLECTION_ID);
            ready = coll.attributes.every(attr => attr.status === 'available');
        }

        console.log("Adding indexes...");
        await databases.createIndex(DATABASE_ID, COLLECTION_ID, 'idx_userId', 'key', ['userId']);
        await databases.createIndex(DATABASE_ID, COLLECTION_ID, 'idx_createdAt', 'key', ['$createdAt'], ['DESC']);

        console.log("Setlists collection setup complete!");

    } catch (error) {
        console.error("Error setting up setlists collection:", error);
    }
}

createSetlistsCollection();
