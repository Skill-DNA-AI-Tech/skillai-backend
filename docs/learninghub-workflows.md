# LearningHub workflow additions

## Personal note versions

- `POST /api/learning/notes/save` stores the first personal version in `student_note_versions`.
- `POST /api/learning/notes/regeneration-requests` requires an authenticated student, ownership of the saved note, and a reason of at least 12 characters.
- `GET /api/learning/notes/regeneration-requests` returns only the requesting student's requests.
- `GET /api/admin/notes/regeneration-requests` and `POST /api/admin/notes/regeneration-requests/{id}/decision` are Admin-only.
- Approval creates a new version, preserves the previous version, updates the saved note, and records an audit event. Rejection preserves the current note and records the decision.

## Monthly theory question batches

- `POST /api/admin/question-batches/generate` creates a versioned curriculum batch with exactly **4 Easy + 7 Medium + 4 Hard** questions.
- `GET /api/learning/question-batches` returns student-visible question content and suppresses `expectedAnswer` and `explanation` until `answerKeyAvailableAt`.
- `POST /api/learning/question-batches/{batchId}/attempt` stores an authenticated student attempt.
- The FastAPI lifespan starts a daily due-check loop. MongoDB lease locking prevents concurrent application instances from publishing duplicate batches.
- Existing batches and attempts are retained. Failed generation is logged and does not delete existing content.

## Deployment caveat

The scheduler is part of the application process and therefore only runs while the deployed FastAPI service is running. Verify the new OpenAPI paths and scheduler audit events after deployment. If the hosting platform restarts or scales to zero, use a platform cron or scheduled job to call the Admin batch-generation endpoint with an authorized service identity.
