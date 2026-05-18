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
          <Link to="/study-sessions/new" className="button primary">
            New Session
          </Link>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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
