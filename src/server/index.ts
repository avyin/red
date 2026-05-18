import "dotenv/config";

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginStudySession,
  deleteStudySession,
  getStudySession,
  initializeDatabase,
  listStudySessions,
  type StudySessionStatus,
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

const server = app.listen(port, () => {
  const address = server.address();
  const actualPort =
    address && typeof address === "object" ? address.port : port;

  console.log(`Study Session Log is running on http://localhost:${actualPort}`);
});
