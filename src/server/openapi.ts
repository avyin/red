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
    ConceptState:
      type: string
      enum:
        - new
        - learning
        - review
        - stable
        - stale
    Concept:
      type: object
      required:
        - id
        - title
        - state
        - createdAt
        - updatedAt
      properties:
        id:
          type: string
        title:
          type: string
        summary:
          type:
            - string
            - "null"
          description: What the student currently understands about this concept.
        state:
          $ref: "#/components/schemas/ConceptState"
        lastStudiedAt:
          type:
            - string
            - "null"
          format: date-time
        lastReviewedAt:
          type:
            - string
            - "null"
          format: date-time
        nextReviewAt:
          type:
            - string
            - "null"
          format: date-time
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    ConceptInput:
      type: object
      required:
        - title
      properties:
        title:
          type: string
        summary:
          type:
            - string
            - "null"
        state:
          $ref: "#/components/schemas/ConceptState"
        lastStudiedAt:
          type:
            - string
            - "null"
          format: date-time
        lastReviewedAt:
          type:
            - string
            - "null"
          format: date-time
        nextReviewAt:
          type:
            - string
            - "null"
          format: date-time
    ConceptUpdate:
      type: object
      properties:
        title:
          type: string
        summary:
          type:
            - string
            - "null"
        state:
          $ref: "#/components/schemas/ConceptState"
        lastStudiedAt:
          type:
            - string
            - "null"
          format: date-time
        lastReviewedAt:
          type:
            - string
            - "null"
          format: date-time
        nextReviewAt:
          type:
            - string
            - "null"
          format: date-time
    ConceptEvidence:
      type: object
      required:
        - id
        - conceptId
        - evidenceType
        - createdAt
      properties:
        id:
          type: string
        conceptId:
          type: string
        studySessionId:
          type:
            - string
            - "null"
        evidenceType:
          type: string
          description: Short cause such as study_session, review, user_explanation, or checkpoint.
        note:
          type:
            - string
            - "null"
        stateBefore:
          oneOf:
            - $ref: "#/components/schemas/ConceptState"
            - type: "null"
        stateAfter:
          oneOf:
            - $ref: "#/components/schemas/ConceptState"
            - type: "null"
        createdAt:
          type: string
          format: date-time
    ConceptEvidenceInput:
      type: object
      required:
        - evidenceType
      properties:
        conceptId:
          type: string
          description: Required when recording evidence outside a concept-specific evidence path.
        studySessionId:
          type:
            - string
            - "null"
        evidenceType:
          type: string
        note:
          type:
            - string
            - "null"
        stateBefore:
          oneOf:
            - $ref: "#/components/schemas/ConceptState"
            - type: "null"
        stateAfter:
          oneOf:
            - $ref: "#/components/schemas/ConceptState"
            - type: "null"
    CheckpointConceptEvidenceInput:
      type: object
      required:
        - evidenceType
      properties:
        studySessionId:
          type:
            - string
            - "null"
        evidenceType:
          type: string
        note:
          type:
            - string
            - "null"
        stateBefore:
          oneOf:
            - $ref: "#/components/schemas/ConceptState"
            - type: "null"
        stateAfter:
          oneOf:
            - $ref: "#/components/schemas/ConceptState"
            - type: "null"
    CheckpointConceptInput:
      type: object
      properties:
        id:
          type: string
          description: Existing concept ID. Omit to create a new concept.
        title:
          type: string
          description: Required when creating a new concept.
        summary:
          type:
            - string
            - "null"
        state:
          $ref: "#/components/schemas/ConceptState"
        lastStudiedAt:
          type:
            - string
            - "null"
          format: date-time
        lastReviewedAt:
          type:
            - string
            - "null"
          format: date-time
        nextReviewAt:
          type:
            - string
            - "null"
          format: date-time
        evidence:
          $ref: "#/components/schemas/CheckpointConceptEvidenceInput"
    LearningCheckpointInput:
      type: object
      properties:
        studySessionId:
          type:
            - string
            - "null"
          description: Session to update or associate with concept evidence.
        session:
          $ref: "#/components/schemas/StudySessionUpdate"
        concepts:
          type: array
          items:
            $ref: "#/components/schemas/CheckpointConceptInput"
        evidence:
          type: array
          items:
            $ref: "#/components/schemas/ConceptEvidenceInput"
    LearningCheckpoint:
      type: object
      required:
        - session
        - concepts
        - evidence
      properties:
        session:
          oneOf:
            - $ref: "#/components/schemas/StudySession"
            - type: "null"
        concepts:
          type: array
          items:
            $ref: "#/components/schemas/Concept"
        evidence:
          type: array
          items:
            $ref: "#/components/schemas/ConceptEvidence"
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
  version: 0.4.0
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
    post:
      operationId: createStudySession
      summary: Create a study session
      requestBody:
        required: false
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/StudySessionInput"
      responses:
        "201":
          description: Study session created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StudySession"
  /api/study-sessions/start:
    get:
      operationId: startStudySession
      summary: Start a study session
      description: Backward-compatible GET start action. Prefer POST startStudySessionPost for new GPT actions.
      responses:
        "200":
          description: Study session started
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StudySession"
    post:
      operationId: startStudySessionPost
      summary: Start a study session
      description: Preferred write endpoint for starting a chat study session after the user's first study-related message.
      requestBody:
        required: false
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/StudySessionInput"
      responses:
        "201":
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
      description: Destructive operation. Use only when the user explicitly asks to delete a session.
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
  /api/concepts:
    get:
      operationId: listConcepts
      summary: List concepts
      parameters:
        - name: search
          in: query
          required: false
          schema:
            type: string
        - name: state
          in: query
          required: false
          schema:
            type: string
            enum:
              - new
              - learning
              - review
              - stable
              - stale
              - all
          description: Optional concept state filter.
      responses:
        "200":
          description: Concepts newest by update time
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Concept"
    post:
      operationId: createConcept
      summary: Create concept
      description: Low-risk learning-map update. Use when the user asks to save or update their map and there is evidence for the concept.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ConceptInput"
      responses:
        "201":
          description: Concept created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Concept"
        "400":
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
  /api/concepts/{id}:
    get:
      operationId: getConcept
      summary: Get one concept
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Concept
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Concept"
        "404":
          description: Concept not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    patch:
      operationId: updateConcept
      summary: Update concept
      description: Low-risk learning-map update. Update concept state only when supported by evidence.
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
              $ref: "#/components/schemas/ConceptUpdate"
      responses:
        "200":
          description: Concept updated
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Concept"
        "400":
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "404":
          description: Concept not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    delete:
      operationId: deleteConcept
      summary: Delete concept
      description: Destructive operation. Use only when the user explicitly asks to delete a concept.
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
          description: Concept not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
  /api/concepts/{id}/evidence:
    get:
      operationId: listConceptEvidence
      summary: List concept evidence
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
      responses:
        "200":
          description: Recent evidence newest first
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/ConceptEvidence"
        "404":
          description: Concept not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
    post:
      operationId: recordConceptEvidence
      summary: Record concept evidence
      description: Low-risk logging update that records why a concept state changed or why it should be reviewed.
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
              $ref: "#/components/schemas/ConceptEvidenceInput"
      responses:
        "201":
          description: Evidence recorded
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ConceptEvidence"
        "400":
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "404":
          description: Concept not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
  /api/learning-checkpoints:
    post:
      operationId: recordLearningCheckpoint
      summary: Record learning checkpoint
      description: Batch natural checkpoint updates for one study session, multiple concepts, and concept evidence. Prefer this at pause, save, review completed, end of topic, update my map, and what should I study next.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/LearningCheckpointInput"
      responses:
        "201":
          description: Checkpoint recorded
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LearningCheckpoint"
        "400":
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "404":
          description: Session or concept not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
components:
  schemas:
    ${schemas}
`;
}
