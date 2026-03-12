import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { defaultConfig } from "../config.js";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) {
    return db;
  }

  const config = defaultConfig;
  const dbDir = path.resolve(config.storage.dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "smart-memory.db");
  db = new DatabaseSync(dbPath);

  initializeSchema(db);

  return db;
}

function initializeSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      schedule_expression TEXT,
      schedule_type TEXT NOT NULL,
      implementation TEXT,
      trigger_time INTEGER NOT NULL,
      last_triggered INTEGER,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_trigger ON tasks(trigger_time) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      messages TEXT NOT NULL,
      summary TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_message_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      info_type TEXT DEFAULT 'temporary',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      source_message TEXT NOT NULL,
      remaining_days INTEGER DEFAULT 60,
      is_permanent INTEGER DEFAULT 0,
      negative_feedback_count INTEGER DEFAULT 0,
      access_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL,
      last_decay_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id);
    CREATE INDEX IF NOT EXISTS idx_entities_key ON entities(user_id, key);
    CREATE INDEX IF NOT EXISTS idx_entities_permanent ON entities(is_permanent);
    CREATE INDEX IF NOT EXISTS idx_entities_remaining_days ON entities(remaining_days);

    CREATE TABLE IF NOT EXISTS extraction_preferences (
      category TEXT PRIMARY KEY,
      score REAL DEFAULT 0.5,
      total_extracted INTEGER DEFAULT 0,
      total_queried INTEGER DEFAULT 0,
      last_queried INTEGER,
      last_extracted INTEGER
    );
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
