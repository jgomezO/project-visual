"use client";

import { useId, useRef } from "react";
import { Plus, X } from "lucide-react";
import { TextInput } from "./form-fields";

export type BulletTone = "neutral" | "danger" | "success";

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
  // Color of the dot left of each row. RiskForm uses `danger` for
  // impacts and `success` for mitigations so the two lists read at a
  // glance even when collapsed.
  tone?: BulletTone;
}

const DEFAULT_MAX = 10;

const TONE_TO_DOT: Record<BulletTone, string> = {
  neutral: "bg-text-muted",
  danger: "bg-error",
  success: "bg-success",
};

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
  tone = "neutral",
}: Props) {
  const labelId = useId();
  // Track refs by index so newly-added rows can autofocus.
  const inputRefs = useRef<Map<number, HTMLInputElement | null>>(new Map());

  const atMax = value.length >= maxItems;
  const dotClass = TONE_TO_DOT[tone];

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
        <span
          id={labelId}
          className="text-xs font-medium uppercase tracking-wide text-text-secondary"
        >
          {label}
        </span>
        <span className="text-xs tabular-nums text-text-muted">
          {value.length} / {maxItems}
        </span>
      </div>

      {value.length === 0 ? (
        <p className="text-sm italic text-text-muted">Sin elementos.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {value.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`inline-block size-2 shrink-0 rounded-full ${dotClass}`}
              />
              <TextInput
                ref={(el) => {
                  if (el) inputRefs.current.set(index, el);
                  else inputRefs.current.delete(index);
                }}
                value={item}
                onChange={(e) => setItem(index, e.currentTarget.value)}
                onKeyDown={(e) => onKeyDown(e, index)}
                placeholder={placeholder}
                aria-labelledby={labelId}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                aria-label={`Remover elemento ${index + 1}`}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-warm-50 hover:text-text-primary disabled:opacity-30"
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
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar item
        </button>
        {errorMessage ? (
          <span className="text-sm text-error" role="alert">
            {errorMessage}
          </span>
        ) : null}
      </div>
    </div>
  );
}
