import "dotenv/config";

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginStudySession,
  conceptStates,
  createConcept,
  createConceptEvidence,
  deleteStudySession,
  deleteConcept,
  getConcept,
  getStudySession,
  initializeDatabase,
  isConceptState,
  listConceptEvidence,
  listConcepts,
  listStudySessions,
  recordLearningCheckpoint,
  type ConceptEvidenceInput,
  type ConceptInput,
  type ConceptState,
  type ConceptUpdateInput,
  type LearningCheckpointInput,
  type StudySessionStatus,
  updateConcept,
  updateStudySession
} from "./db.js";
import { buildOpenApiYaml } from "./openapi.js";

const app = express();
const port = Number(process.env.PORT || 3001);

initializeDatabase();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/study-sessions/start", (_req, res) => {
  res.json(
    beginStudySession({
      endSession: false
    })
  );
});

app.post("/api/study-sessions/start", (req, res) => {
  const topic = readOptionalText(req.body?.topic, "topic");
  if (topic instanceof Error) {
    res.status(400).json({ error: topic.message });
    return;
  }

  const summary = readOptionalText(req.body?.summary, "summary");
  if (summary instanceof Error) {
    res.status(400).json({ error: summary.message });
    return;
  }

  const source = readOptionalText(req.body?.source, "source");
  if (source instanceof Error) {
    res.status(400).json({ error: source.message });
    return;
  }

  res.status(201).json(
    beginStudySession({
      topic,
      summary,
      source,
      endSession: false
    })
  );
});

app.post("/api/study-sessions", (req, res) => {
  const topic = readOptionalText(req.body?.topic, "topic");
  if (topic instanceof Error) {
    res.status(400).json({ error: topic.message });
    return;
  }

  const summary = readOptionalText(req.body?.summary, "summary");
  if (summary instanceof Error) {
    res.status(400).json({ error: summary.message });
    return;
  }

  const source = readOptionalText(req.body?.source, "source");
  if (source instanceof Error) {
    res.status(400).json({ error: source.message });
    return;
  }

  const endSession = readOptionalBoolean(req.body?.endSession, "endSession");
  if (endSession instanceof Error) {
    res.status(400).json({ error: endSession.message });
    return;
  }

  const session = beginStudySession({
    topic,
    summary,
    source,
    endSession: endSession ?? false
  });

  res.status(201).json(session);
});

app.get("/api/study-sessions", (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const status = readSessionStatus(req.query.status);
  if (status instanceof Error) {
    res.status(400).json({ error: status.message });
    return;
  }

  res.json(listStudySessions(search, status));
});

app.get("/api/study-sessions/:id", (req, res) => {
  const session = getStudySession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "study session not found" });
    return;
  }

  res.json(session);
});

app.patch("/api/study-sessions/:id", (req, res) => {
  const input: {
    topic?: string | null;
    summary?: string | null;
    source?: string | null;
    endSession?: boolean;
    pauseSession?: boolean;
    resumeSession?: boolean;
  } = {};

  if (Object.hasOwn(req.body ?? {}, "topic")) {
    const topic = readOptionalText(req.body.topic, "topic");
    if (topic instanceof Error) {
      res.status(400).json({ error: topic.message });
      return;
    }

    input.topic = topic;
  }

  if (Object.hasOwn(req.body ?? {}, "summary")) {
    const summary = readOptionalText(req.body.summary, "summary");
    if (summary instanceof Error) {
      res.status(400).json({ error: summary.message });
      return;
    }

    input.summary = summary;
  }

  if (Object.hasOwn(req.body ?? {}, "source")) {
    const source = readOptionalText(req.body.source, "source");
    if (source instanceof Error) {
      res.status(400).json({ error: source.message });
      return;
    }

    input.source = source;
  }

  if (Object.hasOwn(req.body ?? {}, "endSession")) {
    const endSession = readOptionalBoolean(req.body.endSession, "endSession");
    if (endSession instanceof Error) {
      res.status(400).json({ error: endSession.message });
      return;
    }

    input.endSession = endSession ?? false;
  }

  if (Object.hasOwn(req.body ?? {}, "pauseSession")) {
    const pauseSession = readOptionalBoolean(req.body.pauseSession, "pauseSession");
    if (pauseSession instanceof Error) {
      res.status(400).json({ error: pauseSession.message });
      return;
    }

    input.pauseSession = pauseSession ?? false;
  }

  if (Object.hasOwn(req.body ?? {}, "resumeSession")) {
    const resumeSession = readOptionalBoolean(req.body.resumeSession, "resumeSession");
    if (resumeSession instanceof Error) {
      res.status(400).json({ error: resumeSession.message });
      return;
    }

    input.resumeSession = resumeSession ?? false;
  }

  const requestedStateActions = [
    input.endSession,
    input.pauseSession,
    input.resumeSession
  ].filter(Boolean).length;

  if (requestedStateActions > 1) {
    res.status(400).json({
      error: "only one of endSession, pauseSession, or resumeSession can be true"
    });
    return;
  }

  if (
    input.topic === undefined &&
    input.summary === undefined &&
    input.source === undefined &&
    input.endSession === undefined &&
    input.pauseSession === undefined &&
    input.resumeSession === undefined
  ) {
    res.status(400).json({
      error: "topic, summary, source, endSession, pauseSession, or resumeSession is required"
    });
    return;
  }

  const session = updateStudySession(req.params.id, input);
  if (!session) {
    res.status(404).json({ error: "study session not found" });
    return;
  }

  res.json(session);
});

app.delete("/api/study-sessions/:id", (req, res) => {
  if (!deleteStudySession(req.params.id)) {
    res.status(404).json({ error: "study session not found" });
    return;
  }

  res.status(204).send();
});

app.get("/api/concepts", (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const state = readConceptStateFilter(req.query.state);
  if (state instanceof Error) {
    res.status(400).json({ error: state.message });
    return;
  }

  res.json(listConcepts({ search, state }));
});

app.post("/api/concepts", (req, res) => {
  const input = readConceptInput(req.body, { partial: false });
  if (input instanceof Error) {
    res.status(400).json({ error: input.message });
    return;
  }

  res.status(201).json(createConcept(input));
});

app.get("/api/concepts/:id/evidence", (req, res) => {
  const concept = getConcept(req.params.id);
  if (!concept) {
    res.status(404).json({ error: "concept not found" });
    return;
  }

  const limit = readOptionalPositiveInteger(req.query.limit, "limit");
  if (limit instanceof Error) {
    res.status(400).json({ error: limit.message });
    return;
  }

  res.json(listConceptEvidence(req.params.id, limit ?? 20));
});

app.post("/api/concepts/:id/evidence", (req, res) => {
  const input = readConceptEvidenceInput(req.body, req.params.id);
  if (input instanceof Error) {
    res.status(400).json({ error: input.message });
    return;
  }

  try {
    const evidence = createConceptEvidence(input);
    if (!evidence) {
      res.status(404).json({ error: "concept not found" });
      return;
    }

    res.status(201).json(evidence);
  } catch (err) {
    const message = getErrorMessage(err);
    if (message === "study session not found") {
      res.status(404).json({ error: message });
      return;
    }

    res.status(400).json({ error: message });
  }
});

app.get("/api/concepts/:id", (req, res) => {
  const concept = getConcept(req.params.id);
  if (!concept) {
    res.status(404).json({ error: "concept not found" });
    return;
  }

  res.json(concept);
});

app.patch("/api/concepts/:id", (req, res) => {
  const input = readConceptInput(req.body, { partial: true });
  if (input instanceof Error) {
    res.status(400).json({ error: input.message });
    return;
  }

  if (Object.keys(input).length === 0) {
    res.status(400).json({
      error: "title, summary, state, lastStudiedAt, lastReviewedAt, or nextReviewAt is required"
    });
    return;
  }

  const concept = getConcept(req.params.id);
  if (!concept) {
    res.status(404).json({ error: "concept not found" });
    return;
  }

  const updatedConcept = updateConcept(req.params.id, input);
  res.json(updatedConcept);
});

app.delete("/api/concepts/:id", (req, res) => {
  if (!deleteConcept(req.params.id)) {
    res.status(404).json({ error: "concept not found" });
    return;
  }

  res.status(204).send();
});

app.post("/api/learning-checkpoints", (req, res) => {
  const input = readLearningCheckpointInput(req.body);
  if (input instanceof Error) {
    res.status(400).json({ error: input.message });
    return;
  }

  try {
    res.status(201).json(recordLearningCheckpoint(input));
  } catch (err) {
    const message = getErrorMessage(err);
    if (message === "study session not found" || message === "concept not found") {
      res.status(404).json({ error: message });
      return;
    }

    res.status(400).json({ error: message });
  }
});

app.get("/openapi.yaml", (_req, res) => {
  res.type("yaml").send(buildOpenApiYaml());
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "../client");
const clientIndex = path.join(clientDir, "index.html");

if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(clientIndex);
  });
}

function readConceptInput(value: unknown, options: { partial: false }): ConceptInput | Error;
function readConceptInput(value: unknown, options: { partial: true }): ConceptUpdateInput | Error;
function readConceptInput(
  value: unknown,
  options: { partial: boolean }
): ConceptInput | ConceptUpdateInput | Error {
  if (!isRecord(value)) {
    return new Error("request body must be an object");
  }

  const input: ConceptUpdateInput = {};

  if (Object.hasOwn(value, "title")) {
    const title = readRequiredText(value.title, "title");
    if (title instanceof Error) {
      return title;
    }

    input.title = title;
  } else if (!options.partial) {
    return new Error("title is required");
  }

  if (Object.hasOwn(value, "summary")) {
    const summary = readOptionalText(value.summary, "summary");
    if (summary instanceof Error) {
      return summary;
    }

    input.summary = summary;
  }

  if (Object.hasOwn(value, "state")) {
    const state = readConceptState(value.state, "state");
    if (state instanceof Error) {
      return state;
    }

    input.state = state;
  }

  for (const fieldName of ["lastStudiedAt", "lastReviewedAt", "nextReviewAt"] as const) {
    if (Object.hasOwn(value, fieldName)) {
      const dateText = readOptionalDateTimeText(value[fieldName], fieldName);
      if (dateText instanceof Error) {
        return dateText;
      }

      input[fieldName] = dateText;
    }
  }

  return input as ConceptInput | ConceptUpdateInput;
}

function readConceptEvidenceInput(
  value: unknown,
  conceptIdOverride?: string
): ConceptEvidenceInput | Error {
  if (!isRecord(value)) {
    return new Error("request body must be an object");
  }

  let conceptId = conceptIdOverride;
  if (!conceptId) {
    const readConceptId = readRequiredText(value.conceptId, "conceptId");
    if (readConceptId instanceof Error) {
      return readConceptId;
    }

    conceptId = readConceptId;
  }

  const evidenceType = readRequiredText(value.evidenceType, "evidenceType");
  if (evidenceType instanceof Error) {
    return evidenceType;
  }

  const studySessionId = readOptionalText(value.studySessionId, "studySessionId");
  if (studySessionId instanceof Error) {
    return studySessionId;
  }

  const note = readOptionalText(value.note, "note");
  if (note instanceof Error) {
    return note;
  }

  const stateBefore = readOptionalConceptState(value.stateBefore, "stateBefore");
  if (stateBefore instanceof Error) {
    return stateBefore;
  }

  const stateAfter = readOptionalConceptState(value.stateAfter, "stateAfter");
  if (stateAfter instanceof Error) {
    return stateAfter;
  }

  return {
    conceptId,
    studySessionId,
    evidenceType,
    note,
    stateBefore,
    stateAfter
  };
}

function readLearningCheckpointInput(value: unknown): LearningCheckpointInput | Error {
  if (!isRecord(value)) {
    return new Error("request body must be an object");
  }

  const studySessionId = readOptionalText(value.studySessionId, "studySessionId");
  if (studySessionId instanceof Error) {
    return studySessionId;
  }

  const session = Object.hasOwn(value, "session")
    ? readStudySessionUpdateInput(value.session)
    : undefined;
  if (session instanceof Error) {
    return session;
  }

  if (session && !studySessionId) {
    return new Error("studySessionId is required when session is provided");
  }

  const concepts: NonNullable<LearningCheckpointInput["concepts"]> = [];
  if (Object.hasOwn(value, "concepts")) {
    if (!Array.isArray(value.concepts)) {
      return new Error("concepts must be an array");
    }

    for (const item of value.concepts) {
      if (!isRecord(item)) {
        return new Error("each concept must be an object");
      }

      const id = readOptionalText(item.id, "id");
      if (id instanceof Error) {
        return id;
      }

      const concept = id
        ? readConceptInput(item, { partial: true })
        : readConceptInput(item, { partial: false });
      if (concept instanceof Error) {
        return concept;
      }

      let evidence:
        | NonNullable<NonNullable<LearningCheckpointInput["concepts"]>[number]["evidence"]>
        | undefined;
      if (Object.hasOwn(item, "evidence")) {
        const evidenceInput = readCheckpointConceptEvidenceInput(item.evidence);
        if (evidenceInput instanceof Error) {
          return evidenceInput;
        }

        evidence = evidenceInput;
      }

      concepts.push({ id: id ?? undefined, ...concept, evidence });
    }
  }

  const evidence: ConceptEvidenceInput[] = [];
  if (Object.hasOwn(value, "evidence")) {
    if (!Array.isArray(value.evidence)) {
      return new Error("evidence must be an array");
    }

    for (const item of value.evidence) {
      const evidenceInput = readConceptEvidenceInput(item);
      if (evidenceInput instanceof Error) {
        return evidenceInput;
      }

      evidence.push(evidenceInput);
    }
  }

  if (!session && concepts.length === 0 && evidence.length === 0) {
    return new Error("session, concepts, or evidence is required");
  }

  return {
    studySessionId,
    session,
    concepts,
    evidence
  };
}

function readCheckpointConceptEvidenceInput(
  value: unknown
): NonNullable<NonNullable<LearningCheckpointInput["concepts"]>[number]["evidence"]> | Error {
  if (!isRecord(value)) {
    return new Error("evidence must be an object");
  }

  const evidenceType = readRequiredText(value.evidenceType, "evidenceType");
  if (evidenceType instanceof Error) {
    return evidenceType;
  }

  const studySessionId = readOptionalText(value.studySessionId, "studySessionId");
  if (studySessionId instanceof Error) {
    return studySessionId;
  }

  const note = readOptionalText(value.note, "note");
  if (note instanceof Error) {
    return note;
  }

  const stateBefore = readOptionalConceptState(value.stateBefore, "stateBefore");
  if (stateBefore instanceof Error) {
    return stateBefore;
  }

  const stateAfter = readOptionalConceptState(value.stateAfter, "stateAfter");
  if (stateAfter instanceof Error) {
    return stateAfter;
  }

  return {
    studySessionId,
    evidenceType,
    note,
    stateBefore,
    stateAfter
  };
}

function readStudySessionUpdateInput(value: unknown): LearningCheckpointInput["session"] | Error {
  if (!isRecord(value)) {
    return new Error("session must be an object");
  }

  const input: NonNullable<LearningCheckpointInput["session"]> = {};

  if (Object.hasOwn(value, "topic")) {
    const topic = readOptionalText(value.topic, "topic");
    if (topic instanceof Error) {
      return topic;
    }

    input.topic = topic;
  }

  if (Object.hasOwn(value, "summary")) {
    const summary = readOptionalText(value.summary, "summary");
    if (summary instanceof Error) {
      return summary;
    }

    input.summary = summary;
  }

  if (Object.hasOwn(value, "source")) {
    const source = readOptionalText(value.source, "source");
    if (source instanceof Error) {
      return source;
    }

    input.source = source;
  }

  for (const fieldName of ["endSession", "pauseSession", "resumeSession"] as const) {
    if (Object.hasOwn(value, fieldName)) {
      const flag = readOptionalBoolean(value[fieldName], fieldName);
      if (flag instanceof Error) {
        return flag;
      }

      input[fieldName] = flag ?? false;
    }
  }

  const requestedStateActions = [
    input.endSession,
    input.pauseSession,
    input.resumeSession
  ].filter(Boolean).length;

  if (requestedStateActions > 1) {
    return new Error("only one of endSession, pauseSession, or resumeSession can be true");
  }

  return input;
}

function readRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    return new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return new Error(`${fieldName} is required`);
  }

  return trimmed;
}

function readOptionalText(value: unknown, fieldName: string) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalDateTimeText(value: unknown, fieldName: string) {
  const text = readOptionalText(value, fieldName);
  if (text instanceof Error || text == null) {
    return text;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return new Error(`${fieldName} must be a valid date-time string`);
  }

  return date.toISOString();
}

function readConceptState(value: unknown, fieldName: string): ConceptState | Error {
  if (!isConceptState(value)) {
    return new Error(`${fieldName} must be one of ${conceptStates.join(", ")}`);
  }

  return value;
}

function readOptionalConceptState(
  value: unknown,
  fieldName: string
): ConceptState | null | Error {
  if (value == null) {
    return null;
  }

  return readConceptState(value, fieldName);
}

function readConceptStateFilter(value: unknown): ConceptState | "all" | undefined | Error {
  if (value == null) {
    return undefined;
  }

  if (value === "all") {
    return "all";
  }

  return readConceptState(value, "state");
}

function readOptionalPositiveInteger(value: unknown, fieldName: string) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return new Error(`${fieldName} must be a positive integer`);
  }

  if (!/^\d+$/.test(value)) {
    return new Error(`${fieldName} must be a positive integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return new Error(`${fieldName} must be a positive integer`);
  }

  return Math.min(parsed, 100);
}

function readOptionalBoolean(value: unknown, fieldName: string) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "boolean") {
    return new Error(`${fieldName} must be a boolean`);
  }

  return value;
}

function readSessionStatus(value: unknown): StudySessionStatus | Error {
  if (value == null) {
    return "completed";
  }

  if (typeof value !== "string") {
    return new Error("status must be completed, active, paused, or all");
  }

  if (value === "completed" || value === "active" || value === "paused" || value === "all") {
    return value;
  }

  return new Error("status must be completed, active, paused, or all");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}

const server = app.listen(port, () => {
  const address = server.address();
  const actualPort =
    address && typeof address === "object" ? address.port : port;

  console.log(`Study Session Log is running on http://localhost:${actualPort}`);
});
