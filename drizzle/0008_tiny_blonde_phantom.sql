-- Safe D1 Remote Migration
ALTER TABLE `users` ADD COLUMN `labels` text DEFAULT '[]';
-- We can safely drop 'role' in modern D1 SQLite without dropping the table
ALTER TABLE `users` DROP COLUMN `role`; 