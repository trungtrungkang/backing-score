import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema/*',
  dialect: 'sqlite',
  // Khi kết nối với D1 thật, ta sẽ truyền driver và credentials sau
  // Hiện tại config này dùng để gen file migration SQLite (.sql files)
});
