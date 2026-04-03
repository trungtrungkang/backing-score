const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

const dbDir = path.join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

// Đảm bảo thư mục tồn tại
fs.mkdirSync(dbDir, { recursive: true });

// Xóa file cũ
const files = fs.readdirSync(dbDir);
for (const f of files) {
  if (f.endsWith('.sqlite') || f.endsWith('.sqlite-journal') || f.endsWith('.sqlite-shm') || f.endsWith('.sqlite-wal')) {
    fs.unlinkSync(path.join(dbDir, f));
  }
}

// Tạo file mới
const dbName = 'local_dev.sqlite';
const db = new Database(path.join(dbDir, dbName));

// Bật Pragma
db.exec('PRAGMA defer_foreign_keys = TRUE;');

// Đọc và chạy
try {
  console.log("Reading dump...");
  const sql = fs.readFileSync('d1_dump.sql', 'utf8');
  console.log("Executing dump...");
  db.exec(sql);
  console.log("Restore successful!");
} catch (e) {
  console.error("Error executing SQL:", e);
}
