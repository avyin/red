import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import "./styles.css";

type StudySession = {
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

type SessionStatus = "completed" | "active" | "paused" | "all";
type ConceptState = "new" | "learning" | "review" | "stable" | "stale";
type ConceptStateFilter = ConceptState | "all";

type Concept = {
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

type ConceptEvidence = {
  id: string;
  conceptId: string;
  studySessionId: string | null;
  evidenceType: string;
  note: string | null;
  stateBefore: ConceptState | null;
  stateAfter: ConceptState | null;
  createdAt: string;
};

const conceptStates: ConceptState[] = ["new", "learning", "review", "stable", "stale"];

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the HTTP status message when the response has no JSON body.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <Link to="/" className="brand">
            Study Session Log
          </Link>
          <nav className="topnav" aria-label="Primary">
            <Link to="/" className="text-link">
              Sessions
            </Link>
            <Link to="/concepts" className="text-link">
              Concepts
            </Link>
            <Link to="/study-sessions/new" className="button primary">
              New Session
            </Link>
            <Link to="/concepts/new" className="button">
              New Concept
            </Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/concepts" element={<ConceptsPage />} />
            <Route path="/concepts/new" element={<NewConceptPage />} />
            <Route path="/concepts/:id" element={<ConceptDetailPage />} />
            <Route path="/study-sessions/new" element={<NewStudySessionPage />} />
            <Route path="/study-sessions/:id" element={<StudySessionDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function HomePage() {
  const [sessions, setSessions] = React.useState<StudySession[]>([]);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<SessionStatus>("completed");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ status });
    if (search.trim()) {
      params.set("search", search.trim());
    }

    setLoading(true);
    setError(null);

    apiRequest<StudySession[]>(`/api/study-sessions?${params.toString()}`, {
      signal: controller.signal
    })
      .then(setSessions)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [search, status]);

  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <h1>Study Sessions</h1>
          <p>Saved summaries of what you studied in chat.</p>
        </div>
      </div>

      <input
        className="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search sessions"
        aria-label="Search sessions"
      />

      <div className="segmented-control" aria-label="Session status">
        {(["completed", "active", "paused", "all"] as SessionStatus[]).map((value) => (
          <button
            key={value}
            className={status === value ? "selected" : ""}
            type="button"
            onClick={() => setStatus(value)}
          >
            {capitalize(value)}
          </button>
        ))}
      </div>

      {error ? <p className="message error">{error}</p> : null}
      {loading ? <p className="message">Loading sessions...</p> : null}

      {!loading && sessions.length === 0 ? (
        <p className="message">No study sessions found.</p>
      ) : null}

      <div className="session-grid">
        {sessions.map((session) => (
          <Link
            key={session.id}
            to={`/study-sessions/${session.id}`}
            className="session-card"
          >
            <div className="card-body">
              <h2>{session.topic || "Untitled study session"}</h2>
              <p className="session-summary">
                {session.summary || "Started, but no summary has been saved yet."}
              </p>
            </div>
            <div className="session-meta">
              <span>{session.source || "No source"}</span>
              <span>{formatSessionStatus(session)}</span>
              <span>{formatDate(session.startedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ConceptsPage() {
  const [concepts, setConcepts] = React.useState<Concept[]>([]);
  const [search, setSearch] = React.useState("");
  const [state, setState] = React.useState<ConceptStateFilter>("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (state !== "all") {
      params.set("state", state);
    }

    const query = params.toString();

    setLoading(true);
    setError(null);

    apiRequest<Concept[]>(`/api/concepts${query ? `?${query}` : ""}`, {
      signal: controller.signal
    })
      .then(setConcepts)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [search, state]);

  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <h1>Concepts</h1>
          <p>Durable learning map entries and their current states.</p>
        </div>
      </div>

      <input
        className="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search concepts"
        aria-label="Search concepts"
      />

      <div className="segmented-control" aria-label="Concept state">
        {(["all", ...conceptStates] as ConceptStateFilter[]).map((value) => (
          <button
            key={value}
            className={state === value ? "selected" : ""}
            type="button"
            onClick={() => setState(value)}
          >
            {formatState(value)}
          </button>
        ))}
      </div>

      {error ? <p className="message error">{error}</p> : null}
      {loading ? <p className="message">Loading concepts...</p> : null}

      {!loading && concepts.length === 0 ? <p className="message">No concepts found.</p> : null}

      <div className="session-grid">
        {concepts.map((concept) => (
          <Link key={concept.id} to={`/concepts/${concept.id}`} className="session-card">
            <div className="card-body">
              <h2>{concept.title}</h2>
              <p className="session-summary">
                {concept.summary || "No current understanding summary has been saved yet."}
              </p>
            </div>
            <div className="session-meta">
              <span>{formatState(concept.state)}</span>
              {concept.nextReviewAt ? (
                <span>Review {formatDate(concept.nextReviewAt)}</span>
              ) : (
                <span>Updated {formatDate(concept.updatedAt)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NewStudySessionPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [source, setSource] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const session = await apiRequest<StudySession>("/api/study-sessions", {
        method: "POST",
        body: JSON.stringify({
          topic: topic.trim() || undefined,
          summary,
          source: source.trim() || undefined,
          endSession: true
        })
      });
      navigate(`/study-sessions/${session.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stack narrow">
      <h1>New Study Session</h1>
      <StudySessionForm
        topic={topic}
        summary={summary}
        source={source}
        saving={saving}
        submitLabel="Save"
        onTopicChange={setTopic}
        onSummaryChange={setSummary}
        onSourceChange={setSource}
        onSubmit={handleSubmit}
      />
      {error ? <p className="message error">{error}</p> : null}
    </section>
  );
}

function NewConceptPage() {
  const navigate = useNavigate();
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [state, setState] = React.useState<ConceptState>("new");
  const [lastStudiedAt, setLastStudiedAt] = React.useState("");
  const [lastReviewedAt, setLastReviewedAt] = React.useState("");
  const [nextReviewAt, setNextReviewAt] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const concept = await apiRequest<Concept>("/api/concepts", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
          state,
          lastStudiedAt: lastStudiedAt.trim() || null,
          lastReviewedAt: lastReviewedAt.trim() || null,
          nextReviewAt: nextReviewAt.trim() || null
        })
      });
      navigate(`/concepts/${concept.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stack narrow">
      <h1>New Concept</h1>
      <ConceptForm
        title={title}
        summary={summary}
        state={state}
        lastStudiedAt={lastStudiedAt}
        lastReviewedAt={lastReviewedAt}
        nextReviewAt={nextReviewAt}
        saving={saving}
        submitLabel="Save"
        onTitleChange={setTitle}
        onSummaryChange={setSummary}
        onStateChange={setState}
        onLastStudiedAtChange={setLastStudiedAt}
        onLastReviewedAtChange={setLastReviewedAt}
        onNextReviewAtChange={setNextReviewAt}
        onSubmit={handleSubmit}
      />
      {error ? <p className="message error">{error}</p> : null}
    </section>
  );
}

function StudySessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = React.useState<StudySession | null>(null);
  const [topic, setTopic] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [source, setSource] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiRequest<StudySession>(`/api/study-sessions/${id}`, {
      signal: controller.signal
    })
      .then((loadedSession) => {
        setSession(loadedSession);
        setTopic(loadedSession.topic || "");
        setSummary(loadedSession.summary || "");
        setSource(loadedSession.source || "");
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedSession = await apiRequest<StudySession>(
        `/api/study-sessions/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            topic: topic.trim() || null,
            summary: summary.trim() || null,
            source: source.trim() || null
          })
        }
      );
      setSession(updatedSession);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    await updateSessionState({ endSession: true });
  }

  async function handlePause() {
    await updateSessionState({ pauseSession: true });
  }

  async function handleResume() {
    await updateSessionState({ resumeSession: true });
  }

  async function updateSessionState(body: {
    endSession?: boolean;
    pauseSession?: boolean;
    resumeSession?: boolean;
  }) {
    if (!id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedSession = await apiRequest<StudySession>(
        `/api/study-sessions/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body)
        }
      );
      setSession(updatedSession);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !window.confirm("Delete this study session?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiRequest<void>(`/api/study-sessions/${id}`, { method: "DELETE" });
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="message">Loading study session...</p>;
  }

  if (!session) {
    return (
      <section className="stack narrow">
        <p className="message error">{error || "Study session not found."}</p>
        <Link to="/" className="button">
          Back to Sessions
        </Link>
      </section>
    );
  }

  const sessionStatus = getSessionStatus(session);

  return (
    <section className="stack narrow">
      <Link to="/" className="text-link">
        Back to Sessions
      </Link>

      {editing ? (
        <>
          <h1>Edit Study Session</h1>
          <StudySessionForm
            topic={topic}
            summary={summary}
            source={source}
            saving={saving}
            submitLabel="Save"
            onTopicChange={setTopic}
            onSummaryChange={setSummary}
            onSourceChange={setSource}
            onSubmit={handleUpdate}
          />
          <div className="actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                setTopic(session.topic || "");
                setSummary(session.summary || "");
                setSource(session.source || "");
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <article className="detail-card">
          <div>
            <h1>{session.topic || "Untitled study session"}</h1>
            <p className="detail-content">
              {session.summary || "This session has not been summarized yet."}
            </p>
          </div>

          <div className="session-meta">
            <span>{session.source || "No source"}</span>
            <span>{capitalize(sessionStatus)}</span>
          </div>
          <div className="session-meta">
            <span>Started {formatDate(session.startedAt)}</span>
            {session.pausedAt && sessionStatus === "paused" ? (
              <span>Paused {formatDate(session.pausedAt)}</span>
            ) : null}
            {session.endedAt ? <span>Ended {formatDate(session.endedAt)}</span> : null}
          </div>
          <div className="session-meta">
            <span>Updated {formatDate(session.updatedAt)}</span>
          </div>

          <div className="actions">
            <button className="button primary" type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            {sessionStatus === "active" ? (
              <button
                className="button"
                type="button"
                onClick={handlePause}
                disabled={saving}
              >
                Pause
              </button>
            ) : null}
            {sessionStatus === "paused" ? (
              <button
                className="button"
                type="button"
                onClick={handleResume}
                disabled={saving}
              >
                Resume
              </button>
            ) : null}
            {sessionStatus !== "completed" ? (
              <button
                className="button"
                type="button"
                onClick={handleComplete}
                disabled={saving}
              >
                Mark Complete
              </button>
            ) : null}
            <button className="button danger" type="button" onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          </div>
        </article>
      )}

      {error ? <p className="message error">{error}</p> : null}
    </section>
  );
}

function ConceptDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [concept, setConcept] = React.useState<Concept | null>(null);
  const [evidence, setEvidence] = React.useState<ConceptEvidence[]>([]);
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [state, setState] = React.useState<ConceptState>("new");
  const [lastStudiedAt, setLastStudiedAt] = React.useState("");
  const [lastReviewedAt, setLastReviewedAt] = React.useState("");
  const [nextReviewAt, setNextReviewAt] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      apiRequest<Concept>(`/api/concepts/${id}`, { signal: controller.signal }),
      apiRequest<ConceptEvidence[]>(`/api/concepts/${id}/evidence`, {
        signal: controller.signal
      })
    ])
      .then(([loadedConcept, loadedEvidence]) => {
        setConcept(loadedConcept);
        setEvidence(loadedEvidence);
        setTitle(loadedConcept.title);
        setSummary(loadedConcept.summary || "");
        setState(loadedConcept.state);
        setLastStudiedAt(loadedConcept.lastStudiedAt || "");
        setLastReviewedAt(loadedConcept.lastReviewedAt || "");
        setNextReviewAt(loadedConcept.nextReviewAt || "");
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updatedConcept = await apiRequest<Concept>(`/api/concepts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
          state,
          lastStudiedAt: lastStudiedAt.trim() || null,
          lastReviewedAt: lastReviewedAt.trim() || null,
          nextReviewAt: nextReviewAt.trim() || null
        })
      });
      setConcept(updatedConcept);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !window.confirm("Delete this concept?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiRequest<void>(`/api/concepts/${id}`, { method: "DELETE" });
      navigate("/concepts");
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="message">Loading concept...</p>;
  }

  if (!concept) {
    return (
      <section className="stack narrow">
        <p className="message error">{error || "Concept not found."}</p>
        <Link to="/concepts" className="button">
          Back to Concepts
        </Link>
      </section>
    );
  }

  return (
    <section className="stack narrow">
      <Link to="/concepts" className="text-link">
        Back to Concepts
      </Link>

      {editing ? (
        <>
          <h1>Edit Concept</h1>
          <ConceptForm
            title={title}
            summary={summary}
            state={state}
            lastStudiedAt={lastStudiedAt}
            lastReviewedAt={lastReviewedAt}
            nextReviewAt={nextReviewAt}
            saving={saving}
            submitLabel="Save"
            onTitleChange={setTitle}
            onSummaryChange={setSummary}
            onStateChange={setState}
            onLastStudiedAtChange={setLastStudiedAt}
            onLastReviewedAtChange={setLastReviewedAt}
            onNextReviewAtChange={setNextReviewAt}
            onSubmit={handleUpdate}
          />
          <div className="actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                setTitle(concept.title);
                setSummary(concept.summary || "");
                setState(concept.state);
                setLastStudiedAt(concept.lastStudiedAt || "");
                setLastReviewedAt(concept.lastReviewedAt || "");
                setNextReviewAt(concept.nextReviewAt || "");
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <article className="detail-card">
          <div>
            <h1>{concept.title}</h1>
            <p className="detail-content">
              {concept.summary || "This concept has no current understanding summary."}
            </p>
          </div>

          <div className="session-meta">
            <span>{formatState(concept.state)}</span>
            {concept.lastStudiedAt ? (
              <span>Studied {formatDate(concept.lastStudiedAt)}</span>
            ) : null}
            {concept.lastReviewedAt ? (
              <span>Reviewed {formatDate(concept.lastReviewedAt)}</span>
            ) : null}
            {concept.nextReviewAt ? (
              <span>Next review {formatDate(concept.nextReviewAt)}</span>
            ) : null}
          </div>
          <div className="session-meta">
            <span>Updated {formatDate(concept.updatedAt)}</span>
          </div>

          <div className="actions">
            <button className="button primary" type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="button danger" type="button" onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          </div>
        </article>
      )}

      <section className="stack">
        <h2 className="section-title">Recent Evidence</h2>
        {evidence.length === 0 ? <p className="message">No evidence has been recorded.</p> : null}
        <div className="evidence-list">
          {evidence.map((item) => (
            <article key={item.id} className="evidence-row">
              <div>
                <strong>{formatEvidenceType(item.evidenceType)}</strong>
                <p>{item.note || "No note recorded."}</p>
              </div>
              <div className="session-meta">
                {item.stateBefore || item.stateAfter ? (
                  <span>
                    {item.stateBefore ? formatState(item.stateBefore) : "None"} to{" "}
                    {item.stateAfter ? formatState(item.stateAfter) : "None"}
                  </span>
                ) : null}
                {item.studySessionId ? <span>Session {shortId(item.studySessionId)}</span> : null}
                <span>{formatDate(item.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {error ? <p className="message error">{error}</p> : null}
    </section>
  );
}

function StudySessionForm(props: {
  topic: string;
  summary: string;
  source: string;
  saving: boolean;
  submitLabel: string;
  onTopicChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="session-form" onSubmit={props.onSubmit}>
      <label>
        <span>Topic</span>
        <input
          value={props.topic}
          onChange={(event) => props.onTopicChange(event.target.value)}
          placeholder="Processes and threads"
          autoFocus
        />
      </label>

      <label>
        <span>Summary</span>
        <textarea
          value={props.summary}
          onChange={(event) => props.onSummaryChange(event.target.value)}
          rows={8}
          required
        />
      </label>

      <label>
        <span>Source</span>
        <input
          value={props.source}
          onChange={(event) => props.onSourceChange(event.target.value)}
          placeholder="chatgpt"
        />
      </label>

      <div className="actions">
        <button
          className="button primary"
          type="submit"
          disabled={props.saving || props.summary.trim().length === 0}
        >
          {props.saving ? "Saving..." : props.submitLabel}
        </button>
      </div>
    </form>
  );
}

function ConceptForm(props: {
  title: string;
  summary: string;
  state: ConceptState;
  lastStudiedAt: string;
  lastReviewedAt: string;
  nextReviewAt: string;
  saving: boolean;
  submitLabel: string;
  onTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onStateChange: (value: ConceptState) => void;
  onLastStudiedAtChange: (value: string) => void;
  onLastReviewedAtChange: (value: string) => void;
  onNextReviewAtChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="session-form" onSubmit={props.onSubmit}>
      <label>
        <span>Title</span>
        <input
          value={props.title}
          onChange={(event) => props.onTitleChange(event.target.value)}
          placeholder="JavaScript promises"
          autoFocus
          required
        />
      </label>

      <label>
        <span>Summary</span>
        <textarea
          value={props.summary}
          onChange={(event) => props.onSummaryChange(event.target.value)}
          rows={8}
        />
      </label>

      <label>
        <span>State</span>
        <select
          value={props.state}
          onChange={(event) => props.onStateChange(event.target.value as ConceptState)}
        >
          {conceptStates.map((state) => (
            <option key={state} value={state}>
              {formatState(state)}
            </option>
          ))}
        </select>
      </label>

      <div className="form-grid">
        <label>
          <span>Last Studied</span>
          <input
            value={props.lastStudiedAt}
            onChange={(event) => props.onLastStudiedAtChange(event.target.value)}
            placeholder="2026-05-18T18:00:00.000Z"
          />
        </label>

        <label>
          <span>Last Reviewed</span>
          <input
            value={props.lastReviewedAt}
            onChange={(event) => props.onLastReviewedAtChange(event.target.value)}
            placeholder="2026-05-18T18:00:00.000Z"
          />
        </label>

        <label>
          <span>Next Review</span>
          <input
            value={props.nextReviewAt}
            onChange={(event) => props.onNextReviewAtChange(event.target.value)}
            placeholder="2026-05-25T18:00:00.000Z"
          />
        </label>
      </div>

      <div className="actions">
        <button
          className="button primary"
          type="submit"
          disabled={props.saving || props.title.trim().length === 0}
        >
          {props.saving ? "Saving..." : props.submitLabel}
        </button>
      </div>
    </form>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getSessionStatus(session: StudySession): Exclude<SessionStatus, "all"> {
  if (session.endedAt) {
    return "completed";
  }

  if (session.pausedAt) {
    return "paused";
  }

  return "active";
}

function formatSessionStatus(session: StudySession) {
  return capitalize(getSessionStatus(session));
}

function formatState(value: ConceptStateFilter) {
  return value
    .split("-")
    .map((part) => capitalize(part))
    .join(" ");
}

function formatEvidenceType(value: string) {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => capitalize(part))
    .join(" ");
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
