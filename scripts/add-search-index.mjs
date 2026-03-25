import { Client, Databases, Query } from 'node-appwrite';
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

function removeDiacritics(str) {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const plId = process.env.NEXT_PUBLIC_APPWRITE_PROJECTS_COLLECTION_ID || 'projects';
    const artistId = process.env.NEXT_PUBLIC_APPWRITE_WIKI_ARTISTS_COLLECTION_ID || 'wiki_artists';
    
    console.log("1. Creating 'searchString' attribute...");
    try {
        await databases.createStringAttribute(dbId, plId, 'searchString', 2048, false);
        console.log("Attribute created, waiting 5 seconds for Appwrite to sync...");
        await sleep(5000);
    } catch (e) {
        if (e.message?.includes('already exists')) {
            console.log("Attribute 'searchString' already exists.");
        } else {
            console.error(e);
        }
    }
    
    console.log("2. Creating 'search_idx' index on 'searchString'...");
    try {
        await databases.createIndex(dbId, plId, 'search_idx', 'fulltext', ['searchString'], ['asc']);
        console.log("Index created, waiting 5 seconds...");
        await sleep(5000);
    } catch (e) {
        if (e.message?.includes('already exists')) {
            console.log("Index 'search_idx' already exists.");
        } else {
            console.error(e);
        }
    }
    
    console.log("3. Fetching all projects to generate search paths...");
    let limit = 100;
    let offset = 0;
    let hasMore = true;
    
    // Fetch all artists to build composer map
    console.log("Loading Wiki Artists...");
    const artistMap = {};
    try {
        let aOffset = 0;
        let aHasMore = true;
        while(aHasMore) {
           let aRes = await databases.listDocuments(dbId, artistId, [Query.limit(100), Query.offset(aOffset)]);
           aRes.documents.forEach(a => artistMap[a.$id] = a.name);
           if (aRes.documents.length < 100) aHasMore = false;
           aOffset += 100;
        }
    } catch(e) { console.log('Could not fetch artists:', e.message); }

    while (hasMore) {
        const res = await databases.listDocuments(dbId, plId, [
           Query.limit(limit), 
           Query.offset(offset)
        ]);
        
        for (const pd of res.documents) {
            let tags = pd.tags || [];
            let cNames = (pd.wikiComposerIds || []).map(id => artistMap[id] || "").filter(Boolean);
            
            let rawString = `${pd.name || ""} ${pd.description || ""} ${cNames.join(" ")} ${tags.join(" ")} ${pd.creatorEmail || ""}`;
            let sString = removeDiacritics(rawString);
            
            console.log(`Updating [${pd.name}] -> [${sString.substring(0, 50)}...]`);
            await databases.updateDocument(dbId, plId, pd.$id, {
                searchString: sString
            });
        }
        
        if (res.documents.length < limit) {
            hasMore = false;
        }
        offset += limit;
    }
    
    console.log("✅ All projects successfully migrated with searchString!");
}
main();
