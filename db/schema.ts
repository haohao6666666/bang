import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';

export const privateFiles=sqliteTable('private_files',{
  key:text('key').primaryKey(),
  updatedAt:integer('updated_at').notNull(),
});
export const memoryLocks=sqliteTable('memory_locks',{
  key:text('key').primaryKey(),
  owner:text('owner').notNull(),
  expiresAt:integer('expires_at').notNull(),
});
