# Types

Shared TypeScript contracts for the workspace — the API and its clients compile against the same definitions.

- **Package:** `@cv-jobs-compatibility/types`
- **Contents:** `src/models.ts` (domain shapes, `*Model`), `src/api.ts` (per-endpoint `*Request` / `*Response`)

Types only, no runtime code — every import of this package is erased at compile time. Shared values that survive compilation live in `@cv-jobs-compatibility/constants`.

## Prerequisites

Install workspace dependencies from the repository root:

```bash
pnpm install
```

## Use it in a package

Add it as a dependency of the consuming package, then import with `import type`:

```bash
pnpm --filter @cv-jobs-compatibility/api add "@cv-jobs-compatibility/types@workspace:*"
```

```ts
import type { LoginRequest, UserModel } from '@cv-jobs-compatibility/types'
```

`import type` matters: a plain `import` of a type-only symbol survives transpilation and makes the bundler resolve this package at runtime.

After adding it as a dependency, sync the TypeScript project references — without this the consumer pulls these sources into its own program and resolution fails:

```bash
pnpm exec nx sync
```

## Commands

```bash
pnpm exec nx typecheck @cv-jobs-compatibility/types
pnpm exec nx lint @cv-jobs-compatibility/types
```
