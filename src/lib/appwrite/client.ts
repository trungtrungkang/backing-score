/**
 * Chết đi Appwrite!
 * Đây là vỏ bọc cuối cùng của Client để tránh UI bị crash do Import Errors.
 * Nó hoàn toàn vô sinh và không chứa SDK nào cả.
 */

// Export dummy classes để mock các import đang có trong project
export class Client {
   setEndpoint(...args: any[]) { return this; }
   setProject(...args: any[]) { return this; }
   setKey(...args: any[]) { return this; }
   [key: string]: any;
}

export class Account {
   constructor(client?: any) {}
   async get(...args: any[]): Promise<any> { throw new Error("Appwrite is dead"); }
   async createJWT(...args: any[]): Promise<any> { return { jwt: "" }; }
   async updateVerification(...args: any[]): Promise<any> { return {}; }
   [key: string]: any;
}

export class Databases {
   constructor(client?: any) {}
   async listDocuments(...args: any[]): Promise<any> { return { documents: [], total: 0 }; }
   async getDocument(...args: any[]): Promise<any> { return {}; }
   async createDocument(...args: any[]): Promise<any> { return {}; }
   async updateDocument(...args: any[]): Promise<any> { return {}; }
   async deleteDocument(...args: any[]): Promise<any> {}
   [key: string]: any;
}

export class Storage {
   constructor(client?: any) {}
   [key: string]: any;
}

export const ID = {
   unique: () => crypto.randomUUID()
};

export const Query = {
   equal: (...args: any[]) => "",
   limit: (...args: any[]) => "",
   offset: (...args: any[]) => "",
   orderAsc: (...args: any[]) => "",
   orderDesc: (...args: any[]) => "",
   isNull: (...args: any[]) => "",
   search: (...args: any[]) => "",
   cursorAfter: (...args: any[]) => "",
   cursorBefore: (...args: any[]) => ""
};

export const Role = {
   user: (...args: any[]) => "",
   users: (...args: any[]) => "",
   any: (...args: any[]) => ""
};

export const Permission = {
   read: (...args: any[]) => "",
   write: (...args: any[]) => "",
   update: (...args: any[]) => "",
   delete: (...args: any[]) => ""
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

export namespace Models {
  export interface Document {
    $id: string;
    $collectionId: string;
    $databaseId: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    [key: string]: any;
  }
}
