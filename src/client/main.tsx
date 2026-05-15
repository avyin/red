import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import "./styles.css";

type LearningNote = {
  id: string;
  content: string;
  source: string | null;
  sessionId: string | null;
  sessionStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
            Learning Log
          </Link>
          <Link to="/notes/new" className="button primary">
            New Note
          </Link>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/notes/new" element={<NewNotePage />} />
            <Route path="/notes/:id" element={<NoteDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function HomePage() {
  const [notes, setNotes] = React.useState<LearningNote[]>([]);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";

    setLoading(true);
    setError(null);

    apiRequest<LearningNote[]>(`/api/notes${query}`, { signal: controller.signal })
      .then(setNotes)
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
  }, [search]);

  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <h1>History</h1>
          <p>Plain notes from what you learned.</p>
        </div>
      </div>

      <input
        className="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search notes"
        aria-label="Search notes"
      />

      {error ? <p className="message error">{error}</p> : null}
      {loading ? <p className="message">Loading notes...</p> : null}

      {!loading && notes.length === 0 ? <p className="message">No notes found.</p> : null}

      <div className="note-grid">
        {notes.map((note) => (
          <Link key={note.id} to={`/notes/${note.id}`} className="note-card">
            <p className="note-content">{note.content}</p>
            <div className="note-meta">
              <span>{note.source || "No source"}</span>
              <span>{formatDate(note.createdAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NewNotePage() {
  const navigate = useNavigate();
  const [content, setContent] = React.useState("");
  const [source, setSource] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const note = await apiRequest<LearningNote>("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          content,
          source: source.trim() || undefined
        })
      });
      navigate(`/notes/${note.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stack narrow">
      <h1>New Note</h1>
      <NoteForm
        content={content}
        source={source}
        saving={saving}
        submitLabel="Save"
        onContentChange={setContent}
        onSourceChange={setSource}
        onSubmit={handleSubmit}
      />
      {error ? <p className="message error">{error}</p> : null}
    </section>
  );
}

function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = React.useState<LearningNote | null>(null);
  const [content, setContent] = React.useState("");
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

    apiRequest<LearningNote>(`/api/notes/${id}`, { signal: controller.signal })
      .then((loadedNote) => {
        setNote(loadedNote);
        setContent(loadedNote.content);
        setSource(loadedNote.source || "");
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
      const updatedNote = await apiRequest<LearningNote>(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          content,
          source: source.trim() || null
        })
      });
      setNote(updatedNote);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !window.confirm("Delete this note?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiRequest<void>(`/api/notes/${id}`, { method: "DELETE" });
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="message">Loading note...</p>;
  }

  if (!note) {
    return (
      <section className="stack narrow">
        <p className="message error">{error || "Note not found."}</p>
        <Link to="/" className="button">
          Back to History
        </Link>
      </section>
    );
  }

  return (
    <section className="stack narrow">
      <Link to="/" className="text-link">
        Back to History
      </Link>

      {editing ? (
        <>
          <h1>Edit Note</h1>
          <NoteForm
            content={content}
            source={source}
            saving={saving}
            submitLabel="Save"
            onContentChange={setContent}
            onSourceChange={setSource}
            onSubmit={handleUpdate}
          />
          <div className="actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                setContent(note.content);
                setSource(note.source || "");
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <article className="detail-card">
          <p className="detail-content">{note.content}</p>
          <div className="note-meta">
            <span>{note.source || "No source"}</span>
            <span>Created {formatDate(note.createdAt)}</span>
          </div>
          <div className="note-meta">
            <span>Updated {formatDate(note.updatedAt)}</span>
          </div>
          {note.sessionStartedAt ? (
            <div className="note-meta">
              <span>Session started {formatDate(note.sessionStartedAt)}</span>
            </div>
          ) : null}
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

      {error ? <p className="message error">{error}</p> : null}
    </section>
  );
}

function NoteForm(props: {
  content: string;
  source: string;
  saving: boolean;
  submitLabel: string;
  onContentChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="note-form" onSubmit={props.onSubmit}>
      <label>
        <span>Content</span>
        <textarea
          value={props.content}
          onChange={(event) => props.onContentChange(event.target.value)}
          rows={8}
          required
          autoFocus
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
          disabled={props.saving || props.content.trim().length === 0}
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

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
