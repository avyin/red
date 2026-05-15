const noteSchema = `Note:
      type: object
      required:
        - id
        - content
        - createdAt
        - updatedAt
      properties:
        id:
          type: string
        content:
          type: string
        source:
          type:
            - string
            - "null"
        sessionId:
          type:
            - string
            - "null"
          description: Optional session returned by beginSession.
        sessionStartedAt:
          type:
            - string
            - "null"
          format: date-time
          description: Server timestamp from beginSession for when the learning session began.
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    NoteInput:
      type: object
      required:
        - content
      properties:
        content:
          type: string
        source:
          type:
            - string
            - "null"
        sessionId:
          type:
            - string
            - "null"
          description: Session ID returned by beginSession. If provided, the server uses that session's startedAt timestamp.
        sessionStartedAt:
          type:
            - string
            - "null"
          format: date-time
          description: Server timestamp returned by beginSession. Prefer sending sessionId when available.
    NoteUpdate:
      type: object
      properties:
        content:
          type: string
        source:
          type:
            - string
            - "null"
    Error:
      type: object
      required:
        - error
      properties:
        error:
          type: string
    LearningSession:
      type: object
      required:
        - id
        - startedAt
      properties:
        id:
          type: string
        startedAt:
          type: string
          format: date-time
          description: Server timestamp for when this learning session began.`;

export function getPublicBaseUrl() {
  const fallbackPort = process.env.PORT || "3001";
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${fallbackPort}`).replace(
    /\/+$/,
    ""
  );
}

export function buildOpenApiYaml() {
  const serverUrl = JSON.stringify(getPublicBaseUrl());

  return `openapi: 3.1.0
info:
  title: Learning Log API
  version: 0.1.0
servers:
  - url: ${serverUrl}
paths:
  /health:
    get:
      operationId: healthCheck
      summary: Health check
      responses:
        "200":
          description: Server is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok:
                    type: boolean
  /api/sessions:
    post:
      operationId: beginSession
      summary: Begin a learning session
      description: Create a server-side timestamp that can later be attached to a note.
      responses:
        "201":
          description: Learning session started
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LearningSession"
  /api/notes:
    post:
      operationId: createNote
      summary: Create a learning note
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NoteInput"
      responses:
        "201":
          description: Created note
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Note"
        "400":
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    get:
      operationId: listNotes
      summary: List learning notes
      parameters:
        - name: search
          in: query
          required: false
          schema:
            type: string
      responses:
        "200":
          description: Notes newest first
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Note"
  /api/notes/{id}:
    get:
      operationId: getNote
      summary: Get one learning note
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Note
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Note"
        "404":
          description: Note not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    patch:
      operationId: updateNote
      summary: Update a learning note
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NoteUpdate"
      responses:
        "200":
          description: Updated note
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Note"
        "400":
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "404":
          description: Note not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    delete:
      operationId: deleteNote
      summary: Delete a learning note
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "204":
          description: Deleted
        "404":
          description: Note not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
components:
  schemas:
    ${noteSchema}
`;
}
