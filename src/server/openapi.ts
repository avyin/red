const schemas = `StudySession:
      type: object
      required:
        - id
        - startedAt
        - createdAt
        - updatedAt
      properties:
        id:
          type: string
        topic:
          type:
            - string
            - "null"
          description: Short topic or title for the study session.
        summary:
          type:
            - string
            - "null"
          description: Plain text summary of what the user studied or learned.
        source:
          type:
            - string
            - "null"
          description: Optional source such as chatgpt, gemini, claude, a course, a book, or a URL.
        startedAt:
          type: string
          format: date-time
          description: Server timestamp for when the study session began.
        pausedAt:
          type:
            - string
            - "null"
          format: date-time
          description: Server timestamp for when the study session was paused, or null while active or completed.
        endedAt:
          type:
            - string
            - "null"
          format: date-time
          description: Server timestamp for when the study session was ended or saved.
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    StudySessionInput:
      type: object
      properties:
        topic:
          type:
            - string
            - "null"
        summary:
          type:
            - string
            - "null"
        source:
          type:
            - string
            - "null"
        endSession:
          type: boolean
          description: Set true when creating a manually completed session. Omit or false when beginning a chat study session.
    StudySessionUpdate:
      type: object
      properties:
        topic:
          type:
            - string
            - "null"
        summary:
          type:
            - string
            - "null"
        source:
          type:
            - string
            - "null"
        endSession:
          type: boolean
          description: Set true when the user asks to save or end the study session. The server will set endedAt.
        pauseSession:
          type: boolean
          description: Set true when the user asks to pause or take a break from the study session. The server will set pausedAt.
        resumeSession:
          type: boolean
          description: Set true when the user asks to continue a paused study session. The server will clear pausedAt.
    Error:
      type: object
      required:
        - error
      properties:
        error:
          type: string`;

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
  title: Study Session Log API
  version: 0.3.0
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
  /api/study-sessions:
    get:
      operationId: listStudySessions
      summary: List study sessions
      parameters:
        - name: search
          in: query
          required: false
          schema:
            type: string
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum:
              - completed
              - active
              - paused
              - all
            default: completed
          description: Which sessions to return. Active excludes paused sessions. Defaults to completed.
      responses:
        "200":
          description: Study sessions newest first
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/StudySession"
  /api/study-sessions/start:
    get:
      operationId: startStudySession
      summary: Start a study session
      description: Start tracking a chat study session with a server-side timestamp. No parameters are needed.
      responses:
        "200":
          description: Study session started
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StudySession"
  /api/study-sessions/{id}:
    get:
      operationId: getStudySession
      summary: Get one study session
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Study session
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StudySession"
        "404":
          description: Study session not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    patch:
      operationId: updateStudySession
      summary: Update or complete a study session
      description: Add topic, summary, or source. Set endSession true when the user asks to save or end the session, pauseSession true when the user asks to pause, or resumeSession true when the user asks to continue a paused session.
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
              $ref: "#/components/schemas/StudySessionUpdate"
      responses:
        "200":
          description: Updated study session
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StudySession"
        "400":
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "404":
          description: Study session not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    delete:
      operationId: deleteStudySession
      summary: Delete a study session
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
          description: Study session not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
components:
  schemas:
    ${schemas}
`;
}
