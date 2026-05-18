# Study Session Log App Decisions

Date: 2026-05-18

## Agreed Direction

- The app is a personal-only tool for now.
- The Custom GPT is the primary interface.
- The web UI is an admin/history view for browsing, searching, editing, and deleting saved records.
- Authentication is not part of the MVP for local/private use.
- The app should avoid feeling like a form. The main experience should stay conversational.
- The user initiates study conversations. The GPT should only start tracking after the user's first study-related message.
- The GPT must avoid starting duplicate sessions in the same conversation. Once it starts or resumes a session, it should keep that session ID in conversation context and update that record instead of creating a new one.

## Product Vision

The long-term vision is a smarter study system for people who learn through ChatGPT.

The system should not only save study summaries. It should gradually track what the student knows, where they stopped, what needs review, what may need maintenance, what has been forgotten, and what may need to be relearned.

Over time, the app should build a map of the user's knowledge. Concepts in that map should have state, history, and connections to related concepts, so the GPT can ask better questions, suggest useful review, and continue from the right place.

## Current Product Boundary

The current app stores study sessions. A study session is a learning event: something the user did in chat that can be started, paused, resumed, and saved.

This is a useful first layer, but it is probably not enough for the full vision. A session is temporary and event-based. Knowledge is longer-lived and concept-based.

Because the Custom GPT is the primary interface, the system should not rely on background automation that runs before the user speaks. A study record starts only after the user begins a study interaction.

The app should also account for action approval friction. If every mutation requires user approval, the GPT should avoid frequent small writes. It should prefer fewer, higher-value updates, such as starting a session once, pausing/saving intentionally, or batch-updating concept state at natural checkpoints.

## GPT Session Lifecycle

The user must initiate the conversation. The GPT should not create a study session before the user's first message.

When the user's first message is study-related, the GPT should start or resume one learning record before giving the first substantive teaching response.

After a session is started or resumed, the GPT should keep that session ID in conversation context and continue updating that same record. It should not start another session in the same conversation unless there is a clear topic break, the user asks to start something new, or the previous session has been ended.

The intended lifecycle is:

1. User sends a study-related first message.
2. GPT starts a new session or resumes a clear paused session.
3. GPT teaches normally in the chat.
4. GPT avoids writing tiny updates after every exchange.
5. GPT writes compact updates at natural checkpoints.
6. GPT ends, pauses, or saves the session when the user asks or when the learning block clearly concludes.

This means the session layer should behave like a stable container for the current learning interaction, not like a per-message log.

## Action Approval Friction

Custom GPT actions can create friction because mutating actions may require user approval. If the app tries to write after every meaningful moment, the user may repeatedly need to approve commands, which would make the product feel annoying instead of helpful.

The app should therefore design around fewer, higher-value writes.

Recommended approach:

- Start tracking once after the user's first study-related message.
- Do not start duplicate sessions in the same conversation.
- Avoid mutating state after every message.
- Batch updates when the user pauses, saves, finishes a topic, completes a review, or asks to update their learning map.
- Keep destructive operations, such as delete, explicit and approval-worthy.
- Consider marking low-risk personal logging actions as non-consequential later if the platform and security model support it.
- Avoid relying on a mutating `GET` endpoint long term. Starting a session is a write, so the cleaner API shape is eventually a `POST` with the intended action behavior documented.

The GPT can still reason about the user's learning continuously inside the chat. The important distinction is that reasoning can happen every turn, but persistence should happen at deliberate checkpoints.

## Professional Read

The vision is coherent and worth pursuing, but the app should not try to jump directly from session logging to a full knowledge model.

The safer path is to keep sessions as the raw learning history, then add a second layer for concepts. Sessions answer "what happened in this learning interaction?" Concepts answer "what does the student currently know, and what state is it in?"

This keeps the system understandable while allowing it to become smarter over time.

## Open Questions

- What should count as one study session when the user changes topics mid-chat?
- Should a session be a broad learning block, a single topic, or an automatically segmented conversation?
- What concept states should exist beyond simple saved summaries?
- How should the system decide that something needs review, maintenance, or relearning?
- What should pause/resume mean in the long run: simple status, checkpoint, or progress marker?

## Working Hypothesis

For now, a study session should mean one continuous study interaction, not necessarily one tiny concept.

If the user naturally changes to a new unrelated subject, the GPT can end or pause the current session and start another one. If the user stays within a broader area, the session can contain multiple related concepts.

Later, the system can extract concepts from sessions and maintain those concepts separately.

The concept layer may eventually matter more than the session layer. A user can return to an existing ChatGPT conversation to continue the visible learning thread, while the app's durable value comes from updating what the user knows, what needs review, and how concepts connect.

Because of action approval friction, concept updates should probably be batched. Instead of mutating state after every exchange, the GPT can hold working context during the conversation and save a compact update when the user pauses, saves, finishes a topic, or asks to update their learning map.

## Initial Knowledge Model Decision

The first durable knowledge unit should be a concept.

A concept is a specific thing the user can understand, explain, recognize, or apply. It can be a topic, subtopic, skill, fact cluster, method, or question pattern, but the app should store it under one simple concept model at first.

This avoids over-designing separate models for topics, skills, facts, and question patterns before the product has enough real usage to justify that complexity.

Initial concept fields:

- `title`: short human-readable concept name
- `summary`: what the user currently understands about it
- `state`: simple learning state
- `lastStudiedAt`: when it was last touched in a study session
- `lastReviewedAt`: when the user last demonstrated recall or understanding
- `nextReviewAt`: optional suggested review time
- `relatedConcepts`: optional links to nearby concepts
- `evidence`: short references to the session or interaction that changed the state

Initial concept states:

- `new`: the concept has been introduced but not checked.
- `learning`: the user is actively working through it.
- `review`: the user has shown some understanding, but it should be checked again.
- `stable`: the user has demonstrated enough understanding for now.
- `stale`: the concept has not been reviewed recently and may need maintenance.

The app should not assume that a user knows something just because it was mentioned. A concept state should improve only when there is evidence, such as the user explaining it back, answering a question, applying it correctly, or completing a quick review.

The MVP should use this simple concept model before adding more complex ideas like mastery scores, prerequisite graphs, mistake taxonomies, or automated scheduling.

## Student Workflow

The student workflow should feel like normal learning in ChatGPT, with the app remembering important state quietly in the background.

1. The student starts naturally.

   Example:

   ```text
   I want to learn promises in JavaScript.
   ```

   Or:

   ```text
   Help me review what I was learning yesterday.
   ```

   The app should not begin with a dashboard, setup form, or large menu.

2. The GPT starts or resumes tracking.

   After the first study-related message, the GPT starts a new study session or resumes a relevant paused session if the user asked to continue.

   The GPT should not create another session unless the topic clearly changes, the user asks to start something new, or the previous session was ended.

3. The GPT teaches in small loops.

   The learning pattern should be:

   ```text
   explain -> ask -> user answers -> correct/refine -> practice -> summarize
   ```

   The GPT should avoid long lectures. It should keep checking whether the student can actually understand, recall, and apply the concept.

4. The GPT builds the knowledge map quietly.

   During the chat, the GPT can notice concepts, relationships, weak spots, and review needs.

   It should not save after every message. It should keep working context during the conversation and write durable updates only at useful checkpoints.

5. The GPT saves at natural checkpoints.

   Durable updates should happen when:

   - the user says "save this"
   - the user says "pause"
   - the user finishes a topic
   - the user completes a review
   - the user says "update my map"
   - the user asks what to study next

   At that point, the app can save the session summary and batch-update relevant concept states.

6. The student returns later.

   Example:

   ```text
   What should I review?
   ```

   Or:

   ```text
   Continue where I left off.
   ```

   The GPT should check saved sessions and concept state, then pick up from the most useful point.

   Example response:

   ```text
   You were learning JavaScript promises. You seemed comfortable with what a Promise represents, but async/await still needed practice. Let's do a quick recall check.
   ```

7. The GPT handles review and maintenance.

   Review behavior should depend on concept state:

   - `new`: explain from scratch
   - `learning`: continue teaching and guided practice
   - `review`: ask light recall or application questions
   - `stable`: occasionally maintain
   - `stale`: refresh and check recall

The core workflow is:

```text
start learning -> practice in chat -> demonstrate understanding -> save/update map -> return later -> review what needs attention
```

The product should feel like the student is simply learning in ChatGPT while the app remembers what matters.
