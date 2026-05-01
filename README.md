# Project Visual — Dashboard ejecutivo de Jira

Plataforma interna que conecta con Jira Cloud y muestra el estado de proyectos para audiencias no técnicas (C-level, Customer Success, Implementations).

**Iteración 2 (actual):** Supabase persiste projects, issues, issue_links y sync_runs. `/projects` lee desde Supabase. Un endpoint `POST /api/sync` pulsa Jira y actualiza la base.

## Requisitos

- Node 20+ (probado en 22)
- pnpm 10
- Supabase CLI (https://supabase.com/docs/guides/cli)
- Una cuenta de Jira Cloud con un API token
- Un proyecto Supabase cloud

## Setup (clone fresco)

1. **Variables de entorno.** Copiá la plantilla y completá:

   ```bash
   cp .env.example .env.local
   ```

   Necesitás:
   - **Jira:** `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`. Token en https://id.atlassian.com/manage-profile/security/api-tokens. Opcional `JIRA_PROJECT_KEYS=ENG,OPS,...` para limitar qué proyectos se sincronizan.
   - **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
   - **Sync:** `SYNC_SECRET=$(openssl rand -hex 32)`.

2. **Supabase CLI.** Si no lo tenés: https://supabase.com/docs/guides/cli/getting-started

3. **Vincular y migrar:**

   ```bash
   supabase login                                # Si no estás autenticado
   supabase link --project-ref <tu-ref>          # ref = subdominio de NEXT_PUBLIC_SUPABASE_URL
   supabase db push                              # Aplica las migraciones
   ```

4. **Instalar y arrancar:**

   ```bash
   pnpm install
   pnpm dev
   ```

5. Abrí http://localhost:3000/projects. La primera vez vas a ver el empty state con un botón "Sincronizar ahora".

## Sync manual con curl

```bash
# Incremental, todos los proyectos configurados
curl -X POST -H "x-sync-secret: $SYNC_SECRET" \
  http://localhost:3000/api/sync

# Full re-sync de un proyecto específico
curl -X POST \
  -H "x-sync-secret: $SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"full","projectKey":"NOXSCRUM"}' \
  http://localhost:3000/api/sync
```

Devuelve el row `sync_run` resultante: id, status, sync_type, jql_used, issues_created/updated, links_skipped. 200 si todo OK; 500 si falló (el sync_run queda marcado `failed` con `error_message`).

## Scripts útiles

```bash
pnpm dev               # Dev server (Turbopack)
pnpm build             # Build de producción
pnpm start             # Servir el build
pnpm lint              # ESLint
pnpm gen:types         # Regenerar src/lib/supabase/types.ts después de una migración
```

## Verificar que todo funciona

- ✅ `/projects` muestra cards con nombre, key, lead, total de issues y % en `Done`.
- ✅ El badge "Última sync" arriba de los cards refleja el último sync exitoso.
- ✅ El botón "Resincronizar" hot-refresca la página después del sync (Server Action + revalidatePath).
- ❌ **Falta `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` / claves de Supabase / `SYNC_SECRET`:** la pantalla de error indica qué variable falta.
- ❌ **Credenciales inválidas (401):** la pantalla de error sugiere revisar `.env.local`.
- ❌ **Sin permisos sobre los proyectos (403):** el usuario del API token necesita permiso "Browse projects" en cada proyecto.
- ❌ **Rate limit (429):** el cliente reintenta hasta 3 veces con backoff (`Retry-After` o exponencial 500/1000/2000 ms) antes de fallar.

## Stack

Next.js 16 (App Router) · TypeScript · React 19 · HeroUI v3 · Tailwind CSS v4 · Supabase · pnpm.

Detalles de arquitectura, convenciones y deuda técnica: ver [`CLAUDE.md`](./CLAUDE.md).
