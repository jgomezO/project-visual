"use client";

import { useEffect, useId, useState } from "react";
import { Tooltip } from "@heroui/react";
import { AlertTriangle, ExternalLink, Search, X } from "lucide-react";
import { StatusChip } from "@/components/project/StatusChip";
import type { StatusCategory } from "@/components/project/ProjectTable";
import { getAnonSupabase } from "@/lib/supabase/anon";

interface IssueChipData {
  key: string;
  summary: string;
  status_category: StatusCategory;
}

// Module-level cache so navigating between workstreams in the same session
// doesn't re-query the same issues. Keyed by `${projectId}:${issueKey}`.
// `null` means "we already looked and the issue isn't in our sync".
const chipCache = new Map<string, IssueChipData | null>();

// Resolve cache for provider project keys (e.g. "AUTH" → "10042"). One
// query per unique key per session; `null` means the project isn't
// synced. Lets the dependency form scope its issue autocomplete to a
// different Jira project than the narrative's own.
const projectIdByKeyCache = new Map<string, string | null>();

function cacheKey(projectId: string, issueKey: string): string {
  return `${projectId}:${issueKey}`;
}

interface Props {
  // Default scope: typically the narrative's own project. When
  // providerProjectKey is set, that overrides this for issue queries.
  projectId: string;
  // Optional override: filter suggestions by a different Jira project key
  // (e.g. the provider PoD's project). The component resolves the key to
  // an internal project_id once via a cached lookup.
  providerProjectKey?: string | null;
  value: string[];
  onChange: (next: string[]) => void;
}

export function JiraIssueKeysInput({
  projectId,
  providerProjectKey,
  value,
  onChange,
}: Props) {
  const [resolvedProviderId, setResolvedProviderId] = useState<string | null | "pending">(
    providerProjectKey ? "pending" : null,
  );

  useEffect(() => {
    if (!providerProjectKey) {
      setResolvedProviderId(null);
      return;
    }
    const cached = projectIdByKeyCache.get(providerProjectKey);
    if (cached !== undefined) {
      setResolvedProviderId(cached);
      return;
    }
    let cancelled = false;
    void (async () => {
      const supabase = getAnonSupabase();
      const { data } = await supabase
        .from("projects")
        .select("id")
        .eq("key", providerProjectKey)
        .maybeSingle();
      if (cancelled) return;
      const id = data?.id ?? null;
      projectIdByKeyCache.set(providerProjectKey, id);
      setResolvedProviderId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [providerProjectKey]);

  // Effective project_id used by both hydration and search queries. While
  // the provider key is resolving we treat it as null so we don't fire
  // queries against the narrative's own project (would surface wrong
  // suggestions for a moment).
  const effectiveProjectId =
    providerProjectKey
      ? resolvedProviderId === "pending"
        ? null
        : resolvedProviderId
      : projectId;
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<IssueChipData[]>([]);
  const [searching, setSearching] = useState(false);
  // Re-render trigger: cache mutations don't invalidate React state by
  // themselves, so we tick a counter when hydration completes.
  const [hydrationTick, setHydrationTick] = useState(0);
  const inputId = useId();

  // Hydrate chips for keys we haven't seen before.
  useEffect(() => {
    if (!effectiveProjectId) return;
    const scopeId = effectiveProjectId;
    const missing = value.filter(
      (k) => !chipCache.has(cacheKey(scopeId, k)),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    const supabase = getAnonSupabase();
    void (async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("key, summary, status_category")
        .eq("project_id", scopeId)
        .in("key", missing);
      if (cancelled) return;
      if (error) {
        console.error("[jira-keys] hydration failed", error);
        // Mark all as miss so we don't loop.
        for (const k of missing) chipCache.set(cacheKey(scopeId, k), null);
        setHydrationTick((t) => t + 1);
        return;
      }
      const found = new Set<string>();
      for (const row of data ?? []) {
        chipCache.set(cacheKey(scopeId, row.key), {
          key: row.key,
          summary: row.summary,
          status_category: row.status_category as StatusCategory,
        });
        found.add(row.key);
      }
      for (const k of missing) {
        if (!found.has(k)) chipCache.set(cacheKey(scopeId, k), null);
      }
      setHydrationTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [value, effectiveProjectId]);

  // Debounced autocomplete on the query input.
  useEffect(() => {
    if (query.trim().length === 0 || !effectiveProjectId) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const scopeId = effectiveProjectId;
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      const supabase = getAnonSupabase();
      const safe = query.replace(/[%,]/g, "");
      const { data, error } = await supabase
        .from("issues")
        .select("key, summary, status_category")
        .eq("project_id", scopeId)
        .or(`key.ilike.%${safe}%,summary.ilike.%${safe}%`)
        .order("key")
        .limit(10);
      if (cancelled) return;
      setSearching(false);
      if (error) {
        console.error("[jira-keys] search failed", error);
        setSuggestions([]);
        return;
      }
      const selected = new Set(value);
      const next = (data ?? [])
        .map((d) => ({
          key: d.key,
          summary: d.summary,
          status_category: d.status_category as StatusCategory,
        }))
        .filter((d) => !selected.has(d.key));
      // Warm the cache while we're at it.
      for (const it of next) {
        chipCache.set(cacheKey(scopeId, it.key), it);
      }
      setSuggestions(next);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, effectiveProjectId, value]);

  function addKey(key: string): void {
    if (value.includes(key)) return;
    onChange([...value, key]);
    setQuery("");
    setSuggestions([]);
  }

  function removeKey(key: string): void {
    onChange(value.filter((k) => k !== key));
  }

  // Read for render (hydrationTick is in deps to re-render when cache fills).
  void hydrationTick;
  const chipsForRender = value.map((k) => ({
    key: k,
    data: effectiveProjectId
      ? (chipCache.get(cacheKey(effectiveProjectId, k)) ?? undefined)
      : undefined,
  }));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium" id={`${inputId}-label`}>
        Issues de Jira
      </span>

      {chipsForRender.length === 0 ? (
        <p className="text-xs italic text-muted">Sin issues vinculadas.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {chipsForRender.map(({ key, data }) => (
            <li key={key}>
              <IssueChip
                issueKey={key}
                data={data}
                onRemove={() => removeKey(key)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <div className="flex items-center gap-2 rounded-md border border-default-300 bg-surface px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-default-400">
          <Search
            className="size-3.5 shrink-0 text-muted"
            aria-hidden="true"
          />
          <input
            id={inputId}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Buscar por key o título…"
            className="w-full bg-transparent text-sm focus:outline-none"
            aria-labelledby={`${inputId}-label`}
            autoComplete="off"
          />
          {searching ? (
            <span className="text-xs text-muted">…</span>
          ) : null}
        </div>
        {suggestions.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-default-200 bg-surface shadow-lg">
            {suggestions.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => addKey(s.key)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-default-100"
                >
                  <span className="font-mono text-xs text-muted">
                    {s.key}
                  </span>
                  <span className="truncate">{s.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function IssueChip({
  issueKey,
  data,
  onRemove,
}: {
  issueKey: string;
  data: IssueChipData | null | undefined;
  onRemove: () => void;
}) {
  const jiraBase = process.env.NEXT_PUBLIC_JIRA_BASE_URL?.replace(/\/$/, "");
  const jiraHref = jiraBase ? `${jiraBase}/browse/${issueKey}` : null;

  if (data === undefined) {
    // Hydrating; render a placeholder that doesn't shift width on resolve.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-2 py-0.5 text-xs">
        <span className="font-mono text-muted">{issueKey}</span>
        <span className="text-muted">…</span>
        <ChipRemoveButton onClick={onRemove} />
      </span>
    );
  }

  if (data === null) {
    // Not found in sync.
    return (
      <Tooltip delay={150}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
          <AlertTriangle className="size-3" aria-hidden="true" />
          <span className="font-mono">{issueKey}</span>
          <ChipRemoveButton onClick={onRemove} />
        </span>
        <Tooltip.Content>
          <p className="text-xs">
            Issue no encontrada en sync. Verificá el key o ejecutá un sync.
          </p>
        </Tooltip.Content>
      </Tooltip>
    );
  }

  return (
    <Tooltip delay={150}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-2 py-0.5 text-xs">
        <span className="font-mono text-muted">{issueKey}</span>
        <span className="max-w-[14rem] truncate">{data.summary}</span>
        <StatusChip category={data.status_category} />
        {jiraHref ? (
          <a
            href={jiraHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-muted hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Abrir ${issueKey} en Jira`}
          >
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
        <ChipRemoveButton onClick={onRemove} />
      </span>
      <Tooltip.Content>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-muted">{issueKey}</span>
          <span className="text-sm">{data.summary}</span>
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}

function ChipRemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full p-0.5 hover:bg-default-200"
      aria-label="Remover issue"
    >
      <X className="size-3" aria-hidden="true" />
    </button>
  );
}
