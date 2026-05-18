# Edge-Case Audit

Date: 2026-05-18

Scope: first personal learning-memory MVP with study sessions, concepts, concept evidence, and checkpoint batching.

## Chat Workflow

### User Starts Studying

- Edge case: user opens the GPT but has not sent a study-related message.
  - Handling: GPT docs say not to start tracking before the user's first study-related message.
- Edge case: user asks to list, edit, search, or delete saved records.
  - Handling: GPT docs say not to start a new session for management-only requests.
- Edge case: user says "continue" with paused sessions available.
  - Handling: GPT docs say to list paused sessions before starting a new session and ask if there are multiple plausible matches.
- Edge case: user keeps chatting after pause.
  - Handling: GPT docs resume automatically only when the next message clearly continues study; ambiguous messages require a question.

### Session Tracking

- Edge case: duplicate sessions in one conversation.
  - Handling: GPT docs require keeping the started/resumed session ID in conversation context and updating the same record.
- Edge case: mutating GET for session start.
  - Handling: `POST /api/study-sessions/start` is the preferred action; GET is retained only for backward compatibility.
- Edge case: simultaneous state actions such as pause and end.
  - Handling: API rejects requests where more than one of `endSession`, `pauseSession`, or `resumeSession` is true.

### Teaching And Persistence

- Edge case: approval fatigue from too many action calls.
  - Handling: GPT docs prefer batched persistence at checkpoints instead of every conversational turn.
- Edge case: concept state improves just because a topic was mentioned.
  - Handling: GPT docs require evidence before concept state updates.
- Edge case: user asks what to review next.
  - Handling: GPT docs direct the assistant to inspect concepts and evidence, then use concept state to guide review.

## Server/API

### Study Sessions

- Edge case: active lists include paused sessions.
  - Handling: `status=active` filters to `endedAt IS NULL AND pausedAt IS NULL`.
- Edge case: paused sessions appear completed.
  - Handling: completed uses `endedAt IS NOT NULL`; paused uses `endedAt IS NULL AND pausedAt IS NOT NULL`.
- Edge case: existing databases lack `pausedAt`.
  - Handling: startup migration adds `pausedAt` if missing.

### Concepts

- Edge case: invalid concept state.
  - Handling: API validates state against `new`, `learning`, `review`, `stable`, and `stale`.
- Edge case: missing title on concept create.
  - Handling: API rejects creates without a non-empty title.
- Edge case: invalid review date strings crash the UI later.
  - Handling: API validates and normalizes `lastStudiedAt`, `lastReviewedAt`, and `nextReviewAt` to ISO strings. UI formatting is also tolerant of legacy invalid stored values.
- Edge case: malformed `limit` values such as `1abc`.
  - Handling: concept evidence limit must be a positive integer string and is capped at 100.

### Evidence

- Edge case: evidence refers to a missing concept.
  - Handling: API returns `404 concept not found`.
- Edge case: evidence refers to a missing study session.
  - Handling: evidence creation validates `studySessionId` before insert and returns `404 study session not found`.
- Edge case: checkpoint evidence omits a session but the checkpoint has one.
  - Handling: checkpoint evidence inherits the checkpoint `studySessionId`.
- Edge case: deleting a concept leaves orphaned evidence.
  - Handling: concept delete removes concept evidence in the same transaction.

### Checkpoints

- Edge case: checkpoint tries to update a session without `studySessionId`.
  - Handling: API rejects with `studySessionId is required when session is provided`.
- Edge case: checkpoint has no session, concepts, or evidence.
  - Handling: API rejects empty checkpoint payloads.
- Edge case: checkpoint creates a new concept without a title.
  - Handling: API rejects the concept with a clear title-required error.
- Edge case: checkpoint partially succeeds.
  - Handling: checkpoint writes run in a transaction and roll back on failure.

## Admin UI

- Edge case: legacy invalid date strings exist in the database.
  - Handling: UI date formatter falls back to the raw value instead of throwing.
- Edge case: concept list needs state filtering and search.
  - Handling: concepts view supports search and `all/new/learning/review/stable/stale` filters.
- Edge case: concept detail should explain why a state changed.
  - Handling: concept detail loads and displays recent evidence.
- Edge case: destructive actions are accidental.
  - Handling: session and concept deletes use confirmation prompts and remain separate explicit actions.

## Deferred By Design

- Authentication and multi-user accounts.
- Per-message transcript storage.
- Background jobs and automatic review scheduling.
- Embeddings, vector search, mastery scores, prerequisite graphs, and visual graph rendering.
- Concept relations. They are useful later but outside the first pragmatic concept/evidence layer.
