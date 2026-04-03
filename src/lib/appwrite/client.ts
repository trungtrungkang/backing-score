/**
 * Chết đi Appwrite!
 * Đây là vỏ bọc cuối cùng của Client để tránh UI bị crash do Import Errors.
 * Nó hoàn toàn vô sinh và không chứa SDK nào cả.
 */

// Export dummy classes để mock các import đang có trong project
export class Client {
   setEndpoint() { return this; }
   setProject() { return this; }
}

export class Account {
   constructor(client?: any) {}
   async get(): Promise<any> { throw new Error("Appwrite is dead"); }
   async createJWT(): Promise<any> { return { jwt: "" }; }
}

export class Databases {
   constructor(client?: any) {}
   async listDocuments(): Promise<any> { return { documents: [], total: 0 }; }
   async getDocument(): Promise<any> { return {}; }
   async createDocument(): Promise<any> { return {}; }
   async updateDocument(): Promise<any> { return {}; }
   async deleteDocument(): Promise<any> {}
}

export class Storage {
   constructor(client?: any) {}
}

export const ID = {
   unique: () => crypto.randomUUID()
};

export const Query = {
   equal: () => "",
   limit: () => "",
   offset: () => "",
   orderAsc: () => "",
   orderDesc: () => "",
   isNull: () => "",
   search: () => ""
};

export const Role = {
   user: () => "",
   users: () => ""
};

export const Permission = {
   read: () => "",
   write: () => "",
   update: () => "",
   delete: () => ""
};

export function getAppwriteClient() {
  return new Client();
}

export const account = new Account({});
export const databases = new Databases({});
export const storage = new Storage({});

export async function getAuthToken(): Promise<string | null> {
  return null;
}

export type Models = any;
