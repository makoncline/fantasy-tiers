# Agents Guidelines

This document codifies conventions for building features and agents in this repo. It complements the Repository Guidelines and applies across UI, data fetching, validation, and state management.

## UI Components
- Use shadcn/ui components for all UI primitives and common patterns.
- Keep shadcn components under `src/components/ui` and prefer composition over custom styling.
- Extend via variants/slot props rather than forking base components.

## Forms
- Use `react-hook-form` with shadcn form patterns for all forms.
- Co-locate form schema with the component or export from `src/lib/schemas.ts`.
- Use Zod + `zodResolver` for validation; derive TS types from schemas.
- Prefer uncontrolled inputs. Use `Controller` only when a component cannot be uncontrolled.
- Use shadcn’s `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` wrappers.

Example:

```tsx
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(13),
})

type FormValues = z.infer<typeof schema>

export function ProfileForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', age: 18 },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(values => {/* submit */})}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Age</FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  )
}
```

## Async/Data Fetching
- Use React Query for all async calls (HTTP requests, mutations, background refresh).
- Define query/mutation keys in a central module (e.g., `src/lib/queryKeys.ts`).
- Co-locate query hooks with features (e.g., `src/hooks/usePlayers.ts`) and reuse across components.
- Prefer `useQuery`/`useInfiniteQuery` for reads and `useMutation` for writes; invalidate/prefetch as needed.

Example:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

const Player = z.object({ id: z.string(), name: z.string() })
const Players = z.array(Player)

type Player = z.infer<typeof Player>

export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const res = await fetch('/api/players')
      const json = await res.json()
      return Players.parse(json)
    },
    staleTime: 60_000,
  })
}

export function useUpdatePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: Player) => {
      const res = await fetch(`/api/players/${p.id}`, { method: 'PUT', body: JSON.stringify(p) })
      return Player.parse(await res.json())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['players'] }),
  })
}
```

## Types & Validation
- Use Zod for all runtime validation and type derivation.
- Define schemas in `src/lib/schemas.ts` or feature-specific files; export named schemas.
- Derive types via `z.infer<typeof Schema>`; avoid duplicating interfaces/types.
- Validate all external boundaries: network responses, persisted storage, env vars, URL params.

## Casting
- Never use TypeScript casts unless absolutely necessary.
- If a cast is unavoidable, isolate it, document why, and keep it narrow (never `any`). Prefer `satisfies` and type guards instead.

Bad:
```ts
const data = (await res.json()) as Player[]
```

Good:
```ts
const data = Players.parse(await res.json())
```

## useEffect
- Do not use `useEffect` for derived state, data fetching, or pure computations.
- Only use `useEffect` when syncing with something external to React (subscriptions, DOM APIs, storage, URL/location, timers, imperative focus/measure).
- Prefer event handlers, derived values, and React Query for data lifecycles.

## Additional Conventions
- Keep utilities and schemas in `src/lib/*`; prefer named exports.
- Prefer `satisfies` to enforce object shapes without widening:

```ts
const columns = [/* ... */] as const satisfies ReadonlyArray<ColumnDef<Row>>
```

- Keep Tailwind classes readable and grouped logically; extend via component props rather than ad-hoc class names.
- Organize tests next to source as `*.test.ts` using Vitest.

## Checklist (PR Review)
- Uses shadcn components; no bespoke primitives without reason.
- Forms use react-hook-form with shadcn wrappers and Zod resolver.
- All async calls use React Query with typed keys and Zod-validated results.
- No unnecessary casts; any required cast is isolated and justified.
- No `useEffect` unless syncing external systems.
