import "dotenv/config";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export type StudySession = {
  id: string;
  topic: string | null;
  summary: string | null;
  source: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      topic TEXT,
      summary TEXT,
      source TEXT,
      startedAt TEXT NOT NULL,
      endedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_study_sessions_startedAt
      ON study_sessions (startedAt DESC);
  `);

  migrateLegacyNotes(db);

  if (!database) {
    database = db;
  }
}

function openDatabase() {
  const databasePath = getDatabasePath();
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  return new DatabaseSync(databasePath);
}

function tableExists(db: DatabaseSync, tableName: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | undefined;

  return Boolean(row);
}

function migrateLegacyNotes(db: DatabaseSync) {
  if (!tableExists(db, "learning_notes")) {
    return;
  }

  const legacyColumns = db.prepare("PRAGMA table_info(learning_notes)").all() as Array<{
    name: string;
  }>;
  const hasSessionStartedAt = legacyColumns.some(
    (column) => column.name === "sessionStartedAt"
  );
  const existingCount = db
    .prepare("SELECT COUNT(*) AS count FROM study_sessions")
    .get() as { count: number };

  if (existingCount.count > 0) {
    return;
  }

  db.exec(`
    INSERT INTO study_sessions (
      id,
      topic,
      summary,
      source,
      startedAt,
      endedAt,
      createdAt,
      updatedAt
    )
    SELECT
      id,
      NULL,
      content,
      source,
      ${hasSessionStartedAt ? "COALESCE(sessionStartedAt, createdAt)" : "createdAt"},
      createdAt,
      createdAt,
      updatedAt
    FROM learning_notes;
  `);
}

function normalizeText(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function beginStudySession(input: {
  topic?: string | null;
  summary?: string | null;
  source?: string | null;
  endSession?: boolean;
}) {
  const now = new Date().toISOString();
  const session: StudySession = {
    id: randomUUID(),
    topic: normalizeText(input.topic),
    summary: normalizeText(input.summary),
    source: normalizeText(input.source),
    startedAt: now,
    endedAt: input.endSession ? now : null,
    createdAt: now,
    updatedAt: now
  };

  getDatabase()
    .prepare(
      `INSERT INTO study_sessions (
         id,
         topic,
         summary,
         source,
         startedAt,
         endedAt,
         createdAt,
         updatedAt
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      session.id,
      session.topic,
      session.summary,
      session.source,
      session.startedAt,
      session.endedAt,
      session.createdAt,
      session.updatedAt
    );

  return session;
}

export function listStudySessions(search?: string) {
  const term = search?.trim();

  if (term) {
    const like = `%${term}%`;
    return getDatabase()
      .prepare(
        `SELECT id, topic, summary, source, startedAt, endedAt, createdAt, updatedAt
         FROM study_sessions
         WHERE topic LIKE ? OR summary LIKE ? OR source LIKE ?
         ORDER BY startedAt DESC`
      )
      .all(like, like, like) as StudySession[];
  }

  return getDatabase()
    .prepare(
      `SELECT id, topic, summary, source, startedAt, endedAt, createdAt, updatedAt
       FROM study_sessions
       ORDER BY startedAt DESC`
    )
    .all() as StudySession[];
}

export function getStudySession(id: string) {
  return (
    (getDatabase()
      .prepare(
        `SELECT id, topic, summary, source, startedAt, endedAt, createdAt, updatedAt
         FROM study_sessions
         WHERE id = ?`
      )
      .get(id) as StudySession | undefined) ?? null
  );
}

export function updateStudySession(
  id: string,
  input: {
    topic?: string | null;
    summary?: string | null;
    source?: string | null;
    endSession?: boolean;
  }
) {
  const updates: string[] = [];
  const values: SQLInputValue[] = [];

  if (input.topic !== undefined) {
    updates.push("topic = ?");
    values.push(normalizeText(input.topic));
  }

  if (input.summary !== undefined) {
    updates.push("summary = ?");
    values.push(normalizeText(input.summary));
  }

  if (input.source !== undefined) {
    updates.push("source = ?");
    values.push(normalizeText(input.source));
  }

  const updatedAt = new Date().toISOString();
  if (input.endSession) {
    updates.push("endedAt = COALESCE(endedAt, ?)");
    values.push(updatedAt);
  }

  if (updates.length === 0) {
    return getStudySession(id);
  }

  values.push(updatedAt, id);

  const result = getDatabase()
    .prepare(
      `UPDATE study_sessions
       SET ${updates.join(", ")}, updatedAt = ?
       WHERE id = ?`
    )
    .run(...values);

  if (Number(result.changes) === 0) {
    return null;
  }

  return getStudySession(id);
}

export function deleteStudySession(id: string) {
  const result = getDatabase()
    .prepare("DELETE FROM study_sessions WHERE id = ?")
    .run(id);

  return Number(result.changes) > 0;
}
