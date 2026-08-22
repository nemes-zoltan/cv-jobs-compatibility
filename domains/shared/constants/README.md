# Constants

Domain constants shared across the workspace — values that exist at runtime and that more than one package has to agree on.

- **Package:** `@cv-jobs-compatibility/constants`
- **Contents:** `src/resumes.ts` (upload limits, ingestion statuses), `src/skills.ts` (skill categories), `src/cookies.ts` (the session cookie name)

Anything erased at compile time belongs in `@cv-jobs-compatibility/types` instead.

## Prerequisites

Install workspace dependencies from the repository root:

```bash
pnpm install
```

## Use it in a package

Add it as a dependency of the consuming package, then import the values:

```bash
pnpm --filter @cv-jobs-compatibility/api add "@cv-jobs-compatibility/constants@workspace:*"
```

```ts
import { MAX_RESUME_BYTES, RESUME_INGESTION_STATUSES } from '@cv-jobs-compatibility/constants'
```

Every list is `as const`, so a union comes off it directly:

```ts
type Status = (typeof RESUME_INGESTION_STATUSES)[number]
```

After adding it as a dependency, sync the TypeScript project references:

```bash
pnpm exec nx sync
```

## Commands

```bash
pnpm exec nx typecheck @cv-jobs-compatibility/constants
pnpm exec nx lint @cv-jobs-compatibility/constants
```
