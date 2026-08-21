# Components

Shared [shadcn/ui](https://ui.shadcn.com) component library for the workspace.

- **Package:** `@cv-jobs-compatibility/components`
- **Style:** `radix-nova` (Radix primitives, Lucide icons, neutral base)
- **Config:** [components.json](components.json)

## Add a component

Run from the repository root. `-c` points the CLI at this package, so files land
in `src/components/ui` instead of the app:

```bash
pnpm dlx shadcn@latest add <component> -c libs/ui/components
```

Examples:

```bash
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add dialog input label -c libs/ui/components
```

Then export it from [src/index.ts](src/index.ts) so apps can import it, and
`pnpm install` if the component pulled in new dependencies:

```ts
export { Card, CardHeader, CardContent } from './components/ui/card';
```

Browse the full component list at
[ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components).

## Use it in an app

```tsx
import { Button } from '@cv-jobs-compatibility/components';
```

## Styling

`src/styles/globals.css` owns Tailwind, the shadcn theme, and the dark variant.
Apps import it rather than importing Tailwind themselves — see
[apps/web/src/app/global.css](../../../apps/web/src/app/global.css), which also
declares an `@source` for this package so Tailwind scans component class names.

Inside this package, components import each other with relative paths
(`../../lib/utils`). The shadcn CLI writes those imports as
`@cv-jobs-compatibility/components/lib/utils`, so switch them to relative after
adding a component.

## Commands

| Command | Description |
| --- | --- |
| `pnpm exec nx test @cv-jobs-compatibility/components` | Jest unit tests |
| `pnpm exec nx lint @cv-jobs-compatibility/components` | ESLint |
| `pnpm exec nx typecheck @cv-jobs-compatibility/components` | TypeScript check |
