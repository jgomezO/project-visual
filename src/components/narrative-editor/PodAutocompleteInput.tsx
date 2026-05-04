"use client";

import { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { getAnonSupabase } from "@/lib/supabase/anon";

interface ProjectSuggestion {
  key: string;
  name: string | null;
}

interface Props {
  pod: string | null;
  podKey: string | null;
  onChange: (next: { pod: string | null; podKey: string | null }) => void;
}

/**
 * Free-text input for the provider PoD (team / squad) with autocomplete
 * against the local `projects` table. Picking a suggestion fills BOTH
 * `pod` (display name) and `podKey` (Jira project key, used downstream
 * to scope the provider issue autocomplete and to render an "Open in
 * Jira" link). Free typing fills `pod` only and leaves `podKey` null.
 *
 * When podKey is set, a small "→ KEY" pill renders next to the input
 * with an X to unlink without erasing the pod name — letting the PM
 * keep a verbal team name even after the linked Jira project is
 * cleared.
 */
export function PodAutocompleteInput({ pod, podKey, onChange }: Props) {
  const [query, setQuery] = useState(pod ?? "");
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const inputId = useId();

  // Sync the input when the parent draft changes (e.g. after auto-save
  // returns the row and the form remounts on selection change).
  useEffect(() => {
    setQuery(pod ?? "");
  }, [pod]);

  // Debounced autocomplete against `projects`. Mirrors the JiraIssueKeysInput
  // pattern (200ms, OR-ed key/name ilike, limit 10).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      const supabase = getAnonSupabase();
      const safe = trimmed.replace(/[%,]/g, "");
      const { data, error } = await supabase
        .from("projects")
        .select("key, name")
        .or(`key.ilike.%${safe}%,name.ilike.%${safe}%`)
        .order("key")
        .limit(10);
      if (cancelled) return;
      setSearching(false);
      if (error) {
        console.error("[pod-autocomplete] search failed", error);
        setSuggestions([]);
        return;
      }
      setSuggestions(data ?? []);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  function commitFreeText(next: string): void {
    const trimmed = next.trim();
    onChange({
      pod: trimmed.length === 0 ? null : trimmed,
      // Free-typed text breaks any prior link — the user is no longer
      // pointing at a known project.
      podKey: null,
    });
  }

  function pickSuggestion(s: ProjectSuggestion): void {
    const display = s.name ?? s.key;
    setQuery(display);
    setSuggestions([]);
    onChange({ pod: display, podKey: s.key });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium" id={`${inputId}-label`}>
        Provider (PoD / equipo)
      </span>
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
            onBlur={() => {
              if (query !== (pod ?? "")) commitFreeText(query);
            }}
            placeholder="Equipo o proyecto provider…"
            className="w-full bg-transparent text-sm focus:outline-none"
            aria-labelledby={`${inputId}-label`}
            autoComplete="off"
          />
          {podKey ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-blue-700"
              title={`Vinculado al proyecto Jira ${podKey}`}
            >
              → {podKey}
              <button
                type="button"
                onClick={() => onChange({ pod, podKey: null })}
                className="rounded-full p-0.5 hover:bg-blue-200"
                aria-label="Desvincular del proyecto"
              >
                <X className="size-2.5" aria-hidden="true" />
              </button>
            </span>
          ) : null}
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
                  onClick={() => pickSuggestion(s)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-default-100"
                >
                  <span className="font-mono text-xs text-muted">{s.key}</span>
                  <span className="truncate">{s.name ?? s.key}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        Si el equipo provider no es un proyecto Jira sincronizado, escribilo
        libre y dejá el link sin completar.
      </p>
    </div>
  );
}
