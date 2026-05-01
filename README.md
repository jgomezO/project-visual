# Project Visual — Dashboard ejecutivo de Jira

Plataforma interna que conecta con Jira Cloud y muestra el estado de proyectos para audiencias no técnicas (C-level, Customer Success, Implementations).

Esta primera iteración expone una vista `/projects` con todos los proyectos accesibles y, por cada uno, su lead, total de issues y porcentaje en `Done`.

## Requisitos

- Node 20+ (probado en 22)
- pnpm 10
- Una cuenta de Jira Cloud con un API token

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Editá `.env.local` con tus credenciales:

```
JIRA_BASE_URL=https://tu-empresa.atlassian.net
JIRA_EMAIL=tu-email@empresa.com
JIRA_API_TOKEN=...
# Opcional — si está vacío se listan todos los proyectos accesibles
JIRA_PROJECT_KEYS=ENG,OPS,CS
```

Generá un API token en https://id.atlassian.com/manage-profile/security/api-tokens.

## Correr en desarrollo

```bash
pnpm dev
```

Abrí http://localhost:3000/projects.

### Verificar la conexión con Jira

- ✅ **OK:** la página muestra cards con el nombre y key de cada proyecto, el lead, el total de issues y el % en `Done`.
- ❌ **Falta `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN`:** la pantalla de error indica qué variable falta.
- ❌ **Credenciales inválidas (401):** la pantalla de error sugiere revisar `.env.local`.
- ❌ **Sin permisos sobre los proyectos (403):** el usuario del API token necesita permiso "Browse projects" en cada proyecto.
- ❌ **Rate limit (429):** el cliente reintenta hasta 3 veces con backoff antes de fallar.

## Build de producción

```bash
pnpm build
pnpm start
```

## Stack

Next.js 16 (App Router) · TypeScript · React 19 · HeroUI v3 · Tailwind CSS v4 · pnpm.

Detalles de arquitectura, convenciones, deuda técnica y scope de la próxima iteración: ver [`CLAUDE.md`](./CLAUDE.md).
