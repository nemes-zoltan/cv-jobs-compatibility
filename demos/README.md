# Demos

[Resume Job Compatibility Matcher (AWS Deployed).mp4](Resume%20Job%20Compatibility%20Matcher%20%28AWS%20Deployed%29.mp4)

Recorded against the deployed stack on AWS, not a local machine — ECS Fargate
behind one load balancer, RDS Postgres, S3 and X-Ray. The infrastructure is in
[infra/](../infra/README.md); it was destroyed after recording.

What it covers:

- **Registration** — a new account is signed straight in, no sign-in form to
  retype.
- **CV upload** — the browser gets a presigned URL and `PUT`s the file directly
  to S3. The object is shown landing in the bucket; it never passes through the
  API.
- **Ingestion** — the upload is queued, a worker picks it up, extracts the text
  and runs the model. The parsed CV appears when it finishes.
- **Traces in X-Ray** — one trace for that upload, spanning the API, Postgres,
  S3, the queue, and the worker's call to Gemini. The API and worker are
  separate services joined across the job boundary.
- **Job postings** — an advert is pasted in, parsed, and scored against the CV,
  with the roles ranked by fit.
- **Rejecting bad input** — text that is not a job advert is refused rather
  than scored, and the failure is surfaced instead of silently producing a
  meaningless number.
