import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export type LearningNote = {
  id: string;
  content: string;
  source: string | null;
  sessionId: string | null;
  sessionStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LearningSession = {
  id: string;
  startedAt: string;
};

let database: DatabaseSync | undefined;

function getDatabasePath() {
  const configuredPath = process.env.DATABASE_URL || "./data/app.sqlite";
  if (configuredPath === ":memory:") {
    return configuredPath;
  }

  return path.resolve(process.cwd(), configuredPath);
}

export function getDatabase() {
  if (database) {
    return database;
  }

  database = openDatabase();
  initializeDatabase(database);
  return database;
}

export function initializeDatabase(db = database ?? openDatabase()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_notes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT,
      sessionId TEXT,
      sessionStartedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learning_sessions (
      id TEXT PRIMARY KEY,
      startedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_learning_notes_createdAt
      ON learning_notes (createdAt DESC);
  `);

  ensureColumn(db, "learning_notes", "sessionId", "TEXT");
  ensureColumn(db, "learning_notes", "sessionStartedAt", "TEXT");

  if (!database) {
    database = db;
  }
}

function ensureColumn(
  db: DatabaseSync,
  tableName: string,
  columnName: string,
  columnDefinition: string
) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function openDatabase() {
  const databasePath = getDatabasePath();
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  return new DatabaseSync(databasePath);
}

function normalizeSource(source: string | null | undefined) {
  if (source == null) {
    return null;
  }

  const trimmed = source.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function beginSession() {
  const session: LearningSession = {
    id: randomUUID(),
    startedAt: new Date().toISOString()
  };

  getDatabase()
    .prepare(
      `INSERT INTO learning_sessions (id, startedAt)
       VALUES (?, ?)`
    )
    .run(session.id, session.startedAt);

  return session;
}

export function getSession(id: string) {
  return (
    (getDatabase()
      .prepare(
        `SELECT id, startedAt
         FROM learning_sessions
         WHERE id = ?`
      )
      .get(id) as LearningSession | undefined) ?? null
  );
}

export function createNote(input: {
  content: string;
  source?: string | null;
  sessionId?: string | null;
  sessionStartedAt?: string | null;
}) {
  const now = new Date().toISOString();
  const note: LearningNote = {
    id: randomUUID(),
    content: input.content,
    source: normalizeSource(input.source),
    sessionId: input.sessionId ?? null,
    sessionStartedAt: input.sessionStartedAt ?? null,
    createdAt: now,
    updatedAt: now
  };

  getDatabase()
    .prepare(
      `INSERT INTO learning_notes (
         id,
         content,
         source,
         sessionId,
         sessionStartedAt,
         createdAt,
         updatedAt
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      note.id,
      note.content,
      note.source,
      note.sessionId,
      note.sessionStartedAt,
      note.createdAt,
      note.updatedAt
    );

  return note;
}

export function listNotes(search?: string) {
  const term = search?.trim();

  if (term) {
    const like = `%${term}%`;
    return getDatabase()
      .prepare(
        `SELECT id, content, source, sessionId, sessionStartedAt, createdAt, updatedAt
         FROM learning_notes
         WHERE content LIKE ? OR source LIKE ?
         ORDER BY createdAt DESC`
      )
      .all(like, like) as LearningNote[];
  }

  return getDatabase()
    .prepare(
      `SELECT id, content, source, sessionId, sessionStartedAt, createdAt, updatedAt
       FROM learning_notes
       ORDER BY createdAt DESC`
    )
    .all() as LearningNote[];
}

export function getNote(id: string) {
  return (
    (getDatabase()
      .prepare(
        `SELECT id, content, source, sessionId, sessionStartedAt, createdAt, updatedAt
         FROM learning_notes
         WHERE id = ?`
      )
      .get(id) as LearningNote | undefined) ?? null
  );
}

export function updateNote(
  id: string,
  input: { content?: string; source?: string | null }
) {
  const updates: string[] = [];
  const values: SQLInputValue[] = [];

  if (input.content !== undefined) {
    updates.push("content = ?");
    values.push(input.content);
  }

  if (input.source !== undefined) {
    updates.push("source = ?");
    values.push(normalizeSource(input.source));
  }

  if (updates.length === 0) {
    return getNote(id);
  }

  const updatedAt = new Date().toISOString();
  values.push(updatedAt, id);

  const result = getDatabase()
    .prepare(
      `UPDATE learning_notes
       SET ${updates.join(", ")}, updatedAt = ?
       WHERE id = ?`
    )
    .run(...values);

  if (Number(result.changes) === 0) {
    return null;
  }

  return getNote(id);
}

export function deleteNote(id: string) {
  const result = getDatabase()
    .prepare("DELETE FROM learning_notes WHERE id = ?")
    .run(id);

  return Number(result.changes) > 0;
}
