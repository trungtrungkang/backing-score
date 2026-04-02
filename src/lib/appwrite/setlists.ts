import {
  account,
  databases,
  ID,
  Query,
  Permission,
  Role,
} from "./client";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_SETLISTS_COLLECTION_ID,
} from "./constants";
import { buildStandardPermissions } from "./permissions";
import type { SetlistDocument, SetlistItem } from "./types";

const dbId = APPWRITE_DATABASE_ID;
const collId = APPWRITE_SETLISTS_COLLECTION_ID;

/** Create a new Setlist */
export async function createSetlist(name: string, items: SetlistItem[] = []): Promise<SetlistDocument> {
  const user = await account.get();
  
  const doc = await databases.createDocument(
    dbId,
    collId,
    ID.unique(),
    {
      name: name.trim() || 'Untitled Setlist',
      userId: user.$id,
      items: JSON.stringify(items),
    },
    buildStandardPermissions(user.$id)
  );

  return doc as unknown as SetlistDocument;
}

/** Get a Setlist by ID */
export async function getSetlist(id: string): Promise<SetlistDocument> {
  const doc = await databases.getDocument(dbId, collId, id);
  return doc as unknown as SetlistDocument;
}

/** List all Setlists of the current user */
export async function listMySetlists(): Promise<SetlistDocument[]> {
  const user = await account.get();
  
  const { documents } = await databases.listDocuments(dbId, collId, [
    Query.equal("userId", user.$id),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);

  return documents as unknown as SetlistDocument[];
}

/** Update a Setlist (rename or modify items) */
export async function updateSetlist(
  id: string,
  updates: { name?: string; items?: SetlistItem[] }
): Promise<SetlistDocument> {
  const user = await account.get(); // ensure authed
  
  const data: Record<string, any> = {};
  if (updates.name !== undefined) data.name = updates.name.trim();
  if (updates.items !== undefined) data.items = JSON.stringify(updates.items);

  const doc = await databases.updateDocument(dbId, collId, id, data);
  return doc as unknown as SetlistDocument;
}

/** Delete a Setlist */
export async function deleteSetlist(id: string): Promise<void> {
  await databases.deleteDocument(dbId, collId, id);
}

/** Internal cleanup helper: Sweeps through all setlists to remove a deleted project */
export async function removeProjectFromAllSetlists(projectId: string): Promise<void> {
  try {
    const user = await account.get();
    
    // Fetch user's setlists
    const { documents } = await databases.listDocuments(dbId, collId, [
      Query.equal("userId", user.$id),
      Query.limit(100), // Note: Hard limit 100, can paginate if realistically more
    ]);

    for (const doc of documents) {
      if (doc.items && typeof doc.items === 'string') {
        try {
          const items: SetlistItem[] = JSON.parse(doc.items);
          const newItems = items.filter(item => item.sheetMusicId !== projectId);
          
          if (newItems.length !== items.length) {
            await databases.updateDocument(dbId, collId, doc.$id, {
              items: JSON.stringify(newItems)
            });
          }
        } catch {
           // Skip if unparseable
        }
      }
    }
  } catch {
    // Best-effort cleanup
  }
}
