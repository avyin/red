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
  pausedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudySessionStatus = "completed" | "active" | "paused" | "all";

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
      pausedAt TEXT,
      endedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_study_sessions_startedAt
      ON study_sessions (startedAt DESC);
  `);

  migrateStudySessionsSchema(db);
  migrateLegacyNotes(db);

  if (!database) {
    database = db;
  }
}

function migrateStudySessionsSchema(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(study_sessions)").all() as Array<{
    name: string;
  }>;
  const hasPausedAt = columns.some((column) => column.name === "pausedAt");

  if (!hasPausedAt) {
    db.exec("ALTER TABLE study_sessions ADD COLUMN pausedAt TEXT");
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
      pausedAt,
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
      NULL,
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

function normalizeTopic(value: string | null | undefined) {
  return normalizeText(value) ?? "Untitled study session";
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
    topic: normalizeTopic(input.topic),
    summary: normalizeText(input.summary),
    source: normalizeText(input.source) ?? "chatgpt",
    startedAt: now,
    pausedAt: null,
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
         pausedAt,
         endedAt,
         createdAt,
         updatedAt
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      session.id,
      session.topic,
      session.summary,
      session.source,
      session.startedAt,
      session.pausedAt,
      session.endedAt,
      session.createdAt,
      session.updatedAt
    );

  return session;
}

export function listStudySessions(search?: string, status: StudySessionStatus = "completed") {
  const term = search?.trim();
  const where: string[] = [];
  const values: SQLInputValue[] = [];

  if (status === "completed") {
    where.push("endedAt IS NOT NULL");
  } else if (status === "active") {
    where.push("endedAt IS NULL AND pausedAt IS NULL");
  } else if (status === "paused") {
    where.push("endedAt IS NULL AND pausedAt IS NOT NULL");
  }

  if (term) {
    where.push("(topic LIKE ? OR summary LIKE ? OR source LIKE ?)");
    const like = `%${term}%`;
    values.push(like, like, like);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  return getDatabase()
    .prepare(
      `SELECT id, topic, summary, source, startedAt, pausedAt, endedAt, createdAt, updatedAt
       FROM study_sessions
       ${whereClause}
       ORDER BY startedAt DESC`
    )
    .all(...values) as StudySession[];
}

export function getStudySession(id: string) {
  return (
    (getDatabase()
      .prepare(
        `SELECT id, topic, summary, source, startedAt, pausedAt, endedAt, createdAt, updatedAt
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
    pauseSession?: boolean;
    resumeSession?: boolean;
  }
) {
  const updates: string[] = [];
  const values: SQLInputValue[] = [];

  if (input.topic !== undefined) {
    updates.push("topic = ?");
    values.push(normalizeTopic(input.topic));
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
    updates.push("pausedAt = NULL");
  } else if (input.pauseSession) {
    updates.push(
      "pausedAt = CASE WHEN endedAt IS NULL THEN COALESCE(pausedAt, ?) ELSE pausedAt END"
    );
    values.push(updatedAt);
  } else if (input.resumeSession) {
    updates.push("pausedAt = NULL");
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
