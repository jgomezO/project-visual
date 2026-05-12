# Prism

Dashboard interno de Veevart que conecta Jira y presenta el estado de proyectos en formato presentable para audiencias no técnicas: C-level, Customer Success, Implementations, clientes. No reemplaza Jira — lee, no escribe.

## Dos audiencias

- **¿Vas a usar Prism como PM?** → empezá por [`docs/`](./docs/README.md). Guía completa en español: introducción, cómo escribir narrativas, cómo se comparten, AI assist, FAQ.
- **¿Vas a desarrollar o mantener Prism?** → arquitectura, convenciones, deuda técnica y comandos en [`CLAUDE.md`](./CLAUDE.md).

## Setup rápido

```bash
cp .env.example .env.local       # Completar credenciales (Jira, Supabase, Anthropic, OAuth)
pnpm install
supabase link --project-ref <ref>
supabase db push                 # Aplicar migraciones
pnpm dev                         # http://localhost:3000
```

El setup completo (Google OAuth, Supabase Auth, primer sync, Vercel Cron, etc.) está documentado en CLAUDE.md → "Local setup (fresh clone)".

## Scripts principales

```bash
pnpm dev                # Dev server (Turbopack)
pnpm build              # Build de producción
pnpm test               # Vitest run-once
pnpm test:watch         # Vitest watch
pnpm typecheck          # tsc --noEmit
pnpm lint               # ESLint
pnpm gen:types          # Regenerar src/lib/supabase/types.ts después de una migración
```

## Stack

Next.js 16 (App Router) · TypeScript · React 19 · HeroUI v3 · Tailwind CSS v4 · Supabase · next-intl · Anthropic SDK (Claude Haiku 4.5) · Vitest 4 · pnpm 10 · Node 20+.

CI corre `lint + typecheck + test` en push y PR a `main` (ver [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
