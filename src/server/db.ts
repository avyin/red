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

export const conceptStates = ["new", "learning", "review", "stable", "stale"] as const;

export type ConceptState = (typeof conceptStates)[number];

export type Concept = {
  id: string;
  title: string;
  summary: string | null;
  state: ConceptState;
  lastStudiedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConceptEvidence = {
  id: string;
  conceptId: string;
  studySessionId: string | null;
  evidenceType: string;
  note: string | null;
  stateBefore: ConceptState | null;
  stateAfter: ConceptState | null;
  createdAt: string;
};

export type ConceptListInput = {
  search?: string;
  state?: ConceptState | "all";
};

export type ConceptInput = {
  title: string;
  summary?: string | null;
  state?: ConceptState;
  lastStudiedAt?: string | null;
  lastReviewedAt?: string | null;
  nextReviewAt?: string | null;
};

export type ConceptUpdateInput = Partial<ConceptInput>;

export type ConceptEvidenceInput = {
  conceptId: string;
  studySessionId?: string | null;
  evidenceType: string;
  note?: string | null;
  stateBefore?: ConceptState | null;
  stateAfter?: ConceptState | null;
};

export type LearningCheckpointInput = {
  studySessionId?: string | null;
  session?: {
    topic?: string | null;
    summary?: string | null;
    source?: string | null;
    endSession?: boolean;
    pauseSession?: boolean;
    resumeSession?: boolean;
  };
  concepts?: Array<
    {
      id?: string;
      evidence?: {
        studySessionId?: string | null;
        evidenceType: string;
        note?: string | null;
        stateBefore?: ConceptState | null;
        stateAfter?: ConceptState | null;
      };
    } & ConceptUpdateInput
  >;
  evidence?: ConceptEvidenceInput[];
};

export type LearningCheckpoint = {
  session: StudySession | null;
  concepts: Concept[];
  evidence: ConceptEvidence[];
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
    PRAGMA foreign_keys = ON;

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

    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      state TEXT NOT NULL,
      lastStudiedAt TEXT,
      lastReviewedAt TEXT,
      nextReviewAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_concepts_state
      ON concepts (state);

    CREATE INDEX IF NOT EXISTS idx_concepts_updatedAt
      ON concepts (updatedAt DESC);

    CREATE TABLE IF NOT EXISTS concept_evidence (
      id TEXT PRIMARY KEY,
      conceptId TEXT NOT NULL,
      studySessionId TEXT,
      evidenceType TEXT NOT NULL,
      note TEXT,
      stateBefore TEXT,
      stateAfter TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (conceptId) REFERENCES concepts (id) ON DELETE CASCADE,
      FOREIGN KEY (studySessionId) REFERENCES study_sessions (id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_concept_evidence_conceptId_createdAt
      ON concept_evidence (conceptId, createdAt DESC);
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

function normalizeTitle(value: string) {
  return value.trim();
}

function normalizeState(value: ConceptState | undefined) {
  return value ?? "new";
}

export function isConceptState(value: unknown): value is ConceptState {
  return typeof value === "string" && conceptStates.includes(value as ConceptState);
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

export function listConcepts(input: ConceptListInput = {}) {
  const term = input.search?.trim();
  const where: string[] = [];
  const values: SQLInputValue[] = [];

  if (input.state && input.state !== "all") {
    where.push("state = ?");
    values.push(input.state);
  }

  if (term) {
    where.push("(title LIKE ? OR summary LIKE ? OR state LIKE ?)");
    const like = `%${term}%`;
    values.push(like, like, like);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  return getDatabase()
    .prepare(
      `SELECT id, title, summary, state, lastStudiedAt, lastReviewedAt, nextReviewAt, createdAt, updatedAt
       FROM concepts
       ${whereClause}
       ORDER BY updatedAt DESC`
    )
    .all(...values) as Concept[];
}

export function createConcept(input: ConceptInput) {
  const now = new Date().toISOString();
  const concept: Concept = {
    id: randomUUID(),
    title: normalizeTitle(input.title),
    summary: normalizeText(input.summary),
    state: normalizeState(input.state),
    lastStudiedAt: normalizeText(input.lastStudiedAt),
    lastReviewedAt: normalizeText(input.lastReviewedAt),
    nextReviewAt: normalizeText(input.nextReviewAt),
    createdAt: now,
    updatedAt: now
  };

  getDatabase()
    .prepare(
      `INSERT INTO concepts (
         id,
         title,
         summary,
         state,
         lastStudiedAt,
         lastReviewedAt,
         nextReviewAt,
         createdAt,
         updatedAt
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      concept.id,
      concept.title,
      concept.summary,
      concept.state,
      concept.lastStudiedAt,
      concept.lastReviewedAt,
      concept.nextReviewAt,
      concept.createdAt,
      concept.updatedAt
    );

  return concept;
}

export function getConcept(id: string) {
  return (
    (getDatabase()
      .prepare(
        `SELECT id, title, summary, state, lastStudiedAt, lastReviewedAt, nextReviewAt, createdAt, updatedAt
         FROM concepts
         WHERE id = ?`
      )
      .get(id) as Concept | undefined) ?? null
  );
}

export function updateConcept(id: string, input: ConceptUpdateInput) {
  const updates: string[] = [];
  const values: SQLInputValue[] = [];

  if (input.title !== undefined) {
    updates.push("title = ?");
    values.push(normalizeTitle(input.title));
  }

  if (input.summary !== undefined) {
    updates.push("summary = ?");
    values.push(normalizeText(input.summary));
  }

  if (input.state !== undefined) {
    updates.push("state = ?");
    values.push(input.state);
  }

  if (input.lastStudiedAt !== undefined) {
    updates.push("lastStudiedAt = ?");
    values.push(normalizeText(input.lastStudiedAt));
  }

  if (input.lastReviewedAt !== undefined) {
    updates.push("lastReviewedAt = ?");
    values.push(normalizeText(input.lastReviewedAt));
  }

  if (input.nextReviewAt !== undefined) {
    updates.push("nextReviewAt = ?");
    values.push(normalizeText(input.nextReviewAt));
  }

  if (updates.length === 0) {
    return getConcept(id);
  }

  const updatedAt = new Date().toISOString();
  values.push(updatedAt, id);

  const result = getDatabase()
    .prepare(
      `UPDATE concepts
       SET ${updates.join(", ")}, updatedAt = ?
       WHERE id = ?`
    )
    .run(...values);

  if (Number(result.changes) === 0) {
    return null;
  }

  return getConcept(id);
}

export function deleteConcept(id: string) {
  const db = getDatabase();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM concept_evidence WHERE conceptId = ?").run(id);
    const result = db.prepare("DELETE FROM concepts WHERE id = ?").run(id);
    db.exec("COMMIT");
    return Number(result.changes) > 0;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function listConceptEvidence(conceptId: string, limit = 20) {
  return getDatabase()
    .prepare(
      `SELECT id, conceptId, studySessionId, evidenceType, note, stateBefore, stateAfter, createdAt
       FROM concept_evidence
       WHERE conceptId = ?
       ORDER BY createdAt DESC
       LIMIT ?`
    )
    .all(conceptId, limit) as ConceptEvidence[];
}

export function createConceptEvidence(input: ConceptEvidenceInput) {
  if (!getConcept(input.conceptId)) {
    return null;
  }

  const studySessionId = normalizeText(input.studySessionId);
  if (studySessionId && !getStudySession(studySessionId)) {
    throw new Error("study session not found");
  }

  const now = new Date().toISOString();
  const evidence: ConceptEvidence = {
    id: randomUUID(),
    conceptId: input.conceptId,
    studySessionId,
    evidenceType: normalizeTitle(input.evidenceType),
    note: normalizeText(input.note),
    stateBefore: input.stateBefore ?? null,
    stateAfter: input.stateAfter ?? null,
    createdAt: now
  };

  getDatabase()
    .prepare(
      `INSERT INTO concept_evidence (
         id,
         conceptId,
         studySessionId,
         evidenceType,
         note,
         stateBefore,
         stateAfter,
         createdAt
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      evidence.id,
      evidence.conceptId,
      evidence.studySessionId,
      evidence.evidenceType,
      evidence.note,
      evidence.stateBefore,
      evidence.stateAfter,
      evidence.createdAt
    );

  return evidence;
}

export function recordLearningCheckpoint(input: LearningCheckpointInput): LearningCheckpoint {
  const db = getDatabase();
  db.exec("BEGIN");

  try {
    let session: StudySession | null = null;
    const concepts: Concept[] = [];
    const evidence: ConceptEvidence[] = [];

    if (input.studySessionId) {
      session = input.session
        ? updateStudySession(input.studySessionId, input.session)
        : getStudySession(input.studySessionId);

      if (!session) {
        throw new Error("study session not found");
      }
    }

    for (const conceptInput of input.concepts ?? []) {
      const {
        id,
        evidence: conceptEvidence,
        title,
        summary,
        state,
        lastStudiedAt,
        lastReviewedAt,
        nextReviewAt
      } = conceptInput;

      let concept: Concept | null;
      let stateBefore: ConceptState | null = null;

      if (id) {
        const existingConcept = getConcept(id);
        if (!existingConcept) {
          throw new Error("concept not found");
        }

        stateBefore = existingConcept.state;
        concept = updateConcept(id, {
          title,
          summary,
          state,
          lastStudiedAt,
          lastReviewedAt,
          nextReviewAt
        });
      } else {
        if (!title) {
          throw new Error("title is required for new checkpoint concepts");
        }

        concept = createConcept({
          title,
          summary,
          state,
          lastStudiedAt,
          lastReviewedAt,
          nextReviewAt
        });
      }

      if (!concept) {
        throw new Error("concept not found");
      }

      concepts.push(concept);

      if (conceptEvidence) {
        const recordedEvidence = createConceptEvidence({
          conceptId: concept.id,
          studySessionId:
            conceptEvidence.studySessionId ?? input.studySessionId ?? null,
          evidenceType: conceptEvidence.evidenceType,
          note: conceptEvidence.note,
          stateBefore: conceptEvidence.stateBefore ?? stateBefore,
          stateAfter: conceptEvidence.stateAfter ?? concept.state
        });

        if (!recordedEvidence) {
          throw new Error("concept not found");
        }

        evidence.push(recordedEvidence);
      }
    }

    for (const evidenceInput of input.evidence ?? []) {
      const recordedEvidence = createConceptEvidence({
        ...evidenceInput,
        studySessionId: evidenceInput.studySessionId ?? input.studySessionId ?? null
      });

      if (!recordedEvidence) {
        throw new Error("concept not found");
      }

      evidence.push(recordedEvidence);
    }

    db.exec("COMMIT");
    return { session, concepts, evidence };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
