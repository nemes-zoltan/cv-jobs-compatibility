import { Button } from '@cv-jobs-compatibility/components'

const variants = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'link',
] as const

const sizes = ['xs', 'sm', 'default', 'lg'] as const

export default function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Setup check</h1>
        <p className="text-muted-foreground text-sm">
          Tailwind utilities and the shadcn Button from{' '}
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
            @cv-jobs-compatibility/components
          </code>
          .
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Variants</h2>
        <div className="flex flex-wrap items-center gap-3">
          {variants.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Sizes</h2>
        <div className="flex flex-wrap items-center gap-3">
          {sizes.map((size) => (
            <Button key={size} size={size} variant="outline">
              {size}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Theme tokens</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['bg-primary', 'text-primary-foreground'],
            ['bg-secondary', 'text-secondary-foreground'],
            ['bg-muted', 'text-muted-foreground'],
            ['bg-accent', 'text-accent-foreground'],
          ].map(([bg, fg]) => (
            <div
              key={bg}
              className={`${bg} ${fg} rounded-lg border p-4 text-xs font-medium`}
            >
              {bg}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
