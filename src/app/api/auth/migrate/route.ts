import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/better-auth";
import { users } from "@/db/schema/auth";
import { drizzle } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, appwriteId } = ((await req.json()) as any) as any;

    if (!email || !appwriteId || !password) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    // 1. (Optional) Verify appwrite token using Node SDK to ensure zero-trust 
    // Nhưng vì ta gọi Auth từ frontend nội bộ sau khi Appwrite signIn thành công, 
    // Giả lập mức độ tin cậy cơ bản trước. Bạn nên thêm JWT validation nếu public API này.

    // 2. Chèn User vào D1 database (Sử dụng trực tiếp Drizzle để đính chính xác UUID của Appwrite)
    // env binding process.env.backing_score_prod
    const env = process.env;
    const db = drizzle((env as any).backing_score_prod);
    const auth = getAuth(env); // Để tạo mật khẩu hash

    // Thêm user bằng Better Auth (API Server-side nội bộ)
    const newUser = await auth.api.signUpEmail({
       body: {
         email,
         password,
         name: name || "Appwrite User"
       }
    });

    // NHƯNG, Better Auth sẽ tự gen 1 ID ngẫu nhiên.
    // PHÉP MÀU START: Ta dùng Drizzle UPDATE trực tiếp cái ID đó lại thành ID của Appwrite!
    // Tại vì ID Appwrite dính líu đến mọi dữ liệu Project, Playlist.
    if (newUser?.user) {
        const genId = newUser.user.id;
        
        // Sửa ở bảng users
        await db.run(
           sql`UPDATE users SET id = ${appwriteId} WHERE id = ${genId}`
        );

        // Sửa ở bảng accounts (nếu signUpEmail có tạo)
        await db.run(
           sql`UPDATE accounts SET user_id = ${appwriteId} WHERE user_id = ${genId}`
        );

        // Chú ý: Việc đổi ID này sẽ làm Session vừa login bị lỗi tham chiếu, 
        // Frontend sẽ phải login lại để lấy Session chuẩn gắn với ID mới!
    }

    return NextResponse.json({ success: true, migratedId: appwriteId });

  } catch (error: any) {
    console.error("Migration Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
