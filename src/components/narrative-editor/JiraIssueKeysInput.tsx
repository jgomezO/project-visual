"use client";

import { useEffect, useId, useState } from "react";
import { GeistMono } from "geist/font/mono";
import { Tooltip } from "@heroui/react";
import { AlertTriangle, ExternalLink, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("narratives.inputs.jiraIssues");
  const [resolvedProviderId, setResolvedProviderId] = useState<
    string | null | "pending"
  >(providerProjectKey ? "pending" : null);

  useEffect(() => {
    if (!providerProjectKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync resolved provider id back to null when the parent prop clears. TODO post-iter-8: derive resolvedProviderId via useSyncExternalStore over projectIdByKeyCache so prop transitions don't require an effect.
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
  const effectiveProjectId = providerProjectKey
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear suggestions / loading flag when the query is empty (debounce-reset path). TODO post-iter-8: derive suggestions via a useMemo that returns [] for empty query, fold the search into a useEffectEvent.
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
      <span
        id={`${inputId}-label`}
        className="text-xs font-medium uppercase tracking-wide text-text-secondary"
      >
        {t("label")}
      </span>

      {chipsForRender.length === 0 ? (
        <p className="text-sm italic text-text-muted">{t("empty")}</p>
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
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 transition-colors focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary-500">
          <Search
            className="size-4 shrink-0 text-text-muted"
            aria-hidden="true"
          />
          <input
            id={inputId}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            aria-labelledby={`${inputId}-label`}
            autoComplete="off"
          />
          {searching ? (
            <span className="text-xs text-text-muted">…</span>
          ) : null}
        </div>
        {suggestions.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
            {suggestions.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => addKey(s.key)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-primary-50 focus-visible:bg-primary-100 focus-visible:outline-none"
                >
                  <span
                    className={`${GeistMono.className} text-xs text-text-muted`}
                  >
                    {s.key}
                  </span>
                  <span className="truncate text-text-primary">
                    {s.summary}
                  </span>
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
  const t = useTranslations("narratives.inputs.jiraIssues.chip");
  const jiraBase = process.env.NEXT_PUBLIC_JIRA_BASE_URL?.replace(/\/$/, "");
  const jiraHref = jiraBase ? `${jiraBase}/browse/${issueKey}` : null;

  if (data === undefined) {
    // Hydrating; render a placeholder that doesn't shift width on resolve.
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warm-100 px-2.5 py-1 text-xs">
        <span className={`${GeistMono.className} text-text-muted`}>
          {issueKey}
        </span>
        <span className="text-text-muted">…</span>
        <ChipRemoveButton onClick={onRemove} />
      </span>
    );
  }

  if (data === null) {
    // Not found in sync.
    return (
      <Tooltip delay={150}>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-bg px-2.5 py-1 text-xs text-warning">
          <AlertTriangle className="size-3" aria-hidden="true" />
          <span className={GeistMono.className}>{issueKey}</span>
          <ChipRemoveButton onClick={onRemove} />
        </span>
        <Tooltip.Content>
          <p className="text-xs">{t("notFoundTooltip")}</p>
        </Tooltip.Content>
      </Tooltip>
    );
  }

  return (
    <Tooltip delay={150}>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-xs text-primary-700">
        <span className={`${GeistMono.className} text-primary-800`}>
          {issueKey}
        </span>
        <span className="max-w-[14rem] truncate">{data.summary}</span>
        <StatusChip category={data.status_category} />
        {jiraHref ? (
          <a
            href={jiraHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-primary-700 transition-colors hover:text-primary-900"
            onClick={(e) => e.stopPropagation()}
            aria-label={t("openAria", { key: issueKey })}
          >
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
        <ChipRemoveButton onClick={onRemove} />
      </span>
      <Tooltip.Content>
        <div className="flex flex-col gap-1">
          <span className={`${GeistMono.className} text-xs text-text-muted`}>
            {issueKey}
          </span>
          <span className="text-sm text-text-primary">{data.summary}</span>
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}

function ChipRemoveButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("narratives.inputs.jiraIssues.chip");
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full p-0.5 transition-colors hover:bg-primary-200"
      aria-label={t("removeAria")}
    >
      <X className="size-3" aria-hidden="true" />
    </button>
  );
}
