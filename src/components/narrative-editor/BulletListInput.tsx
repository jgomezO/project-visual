"use client";

import { useId, useRef } from "react";
import { Plus, X } from "lucide-react";

interface Props {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  // Used as the per-row placeholder. Same string for every row to keep
  // the cue consistent — the row position carries no semantic weight.
  placeholder?: string;
  // Hard ceiling. The "Agregar" button disables when reached. Default 10
  // matches the `narrative_risks` editor expectation: a risk's impacts
  // and mitigations are summary bullets, not a detailed breakdown.
  maxItems?: number;
  // Optional hint shown below the rows. Used by RiskForm to surface a
  // "Mínimo un elemento" message after a failed save attempt; the
  // component does NOT compute validation itself.
  errorMessage?: string | null;
}

const DEFAULT_MAX = 10;

// Reusable editor for TEXT[] columns. Renders the array as-is — empty
// strings are allowed during typing — and fires `onChange` with the raw
// array. The parent form is responsible for trim/filter at save time and
// for surfacing structural errors via `errorMessage`.
//
// Keyboard ergonomics: Enter on the last row adds a new empty row when
// below max. No focus-management for backspace-on-empty — keeps the
// component simple and predictable.
export function BulletListInput({
  label,
  value,
  onChange,
  placeholder,
  maxItems = DEFAULT_MAX,
  errorMessage,
}: Props) {
  const labelId = useId();
  // Track refs by index so newly-added rows can autofocus.
  const inputRefs = useRef<Map<number, HTMLInputElement | null>>(new Map());

  const atMax = value.length >= maxItems;

  function setItem(index: number, text: string): void {
    const next = value.slice();
    next[index] = text;
    onChange(next);
  }

  function removeItem(index: number): void {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  }

  function addItem(): void {
    if (atMax) return;
    const next = [...value, ""];
    onChange(next);
    // Focus the newly-added input on the next paint.
    requestAnimationFrame(() => {
      inputRefs.current.get(next.length - 1)?.focus();
    });
  }

  function onKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ): void {
    if (e.key === "Enter" && index === value.length - 1 && !atMax) {
      e.preventDefault();
      addItem();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium" id={labelId}>
          {label}
        </span>
        <span className="text-xs text-muted tabular-nums">
          {value.length} / {maxItems}
        </span>
      </div>

      {value.length === 0 ? (
        <p className="text-xs italic text-muted">Sin elementos.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {value.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="select-none text-xs text-muted tabular-nums"
              >
                {index + 1}.
              </span>
              <input
                ref={(el) => {
                  if (el) inputRefs.current.set(index, el);
                  else inputRefs.current.delete(index);
                }}
                value={item}
                onChange={(e) => setItem(index, e.currentTarget.value)}
                onKeyDown={(e) => onKeyDown(e, index)}
                placeholder={placeholder}
                aria-labelledby={labelId}
                className="flex-1 rounded-md border border-default-300 bg-surface px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-default-400"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                aria-label={`Remover elemento ${index + 1}`}
                className="rounded-md p-1 text-muted hover:bg-default-100 hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={addItem}
          disabled={atMax}
          className="inline-flex items-center gap-1.5 rounded-md border border-default-300 bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Agregar
        </button>
        {errorMessage ? (
          <span className="text-xs text-danger">{errorMessage}</span>
        ) : null}
      </div>
    </div>
  );
}
