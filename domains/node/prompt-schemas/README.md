# prompt-schemas

Prompts and response schemas for everything we ask an LLM, versioned together.

- **Package:** `@cv-jobs-compatibility/prompt-schemas`

## Usage

The root export is the current version:

```ts
import {
  RESUME_EXTRACTION_PROMPT_VERSION,
  RESUME_EXTRACTION_SYSTEM_PROMPT,
  RESUME_EXTRACTION_RESPONSE_SCHEMA,
  buildResumeExtractionPrompt,
  resumeExtractionResponseSchema,
} from '@cv-jobs-compatibility/prompt-schemas'
```

Import a version explicitly to pin it:

```ts
import { resumeExtractionResponseSchema } from '@cv-jobs-compatibility/prompt-schemas/v1'
```

Each schema is defined once in zod and used twice: `RESUME_EXTRACTION_RESPONSE_SCHEMA` is the JSON Schema sent to the model, and the zod schema parses what comes back.

Because that JSON Schema is derived — from zod, and from `SKILL_CATEGORIES` in `@cv-jobs-compatibility/constants` — each version commits the exact schema it emits alongside it (`resume-extraction.response-schema.json`) and a test asserts the two match. A change upstream fails that test instead of silently altering what a released version asks for.

## Adding a version

Copy `src/v1` to `src/v2`, change what needs changing, bump the version constant inside it, then add a `./v2` entry to `exports` in `package.json` and repoint `src/index.ts`. Regenerate the new version's committed JSON Schema from its own test failure. Never edit a released version — a stored `promptVersion` has to keep meaning what it meant.

## Commands

```bash
pnpm exec nx test @cv-jobs-compatibility/prompt-schemas
pnpm exec nx lint @cv-jobs-compatibility/prompt-schemas
pnpm exec nx typecheck @cv-jobs-compatibility/prompt-schemas
```
