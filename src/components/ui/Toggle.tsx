import { forwardRef } from "react";

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
}

// Custom switch primitive (Prism, iter 4h R2). Replaces HeroUI Switch
// in places where its raw-blue thumb / track clashed with the lavender
// brand. Native <button role="switch" aria-checked> with a styled
// track + thumb (no labels-after-or-before juggling — the label is
// always after the track here, which is what every consumer wants).
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  function Toggle({ checked, onChange, label, className }, ref) {
    const wrapperClass = [
      "group inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors hover:bg-warm-50",
      className ?? "",
    ]
      .join(" ")
      .trim();
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={wrapperClass}
      >
        <span
          className={
            checked
              ? "relative h-5 w-9 rounded-full bg-primary-500 transition-colors"
              : "relative h-5 w-9 rounded-full bg-cool-200 transition-colors"
          }
        >
          <span
            className={
              checked
                ? "absolute left-0.5 top-0.5 size-4 translate-x-4 rounded-full bg-surface shadow-sm transition-transform"
                : "absolute left-0.5 top-0.5 size-4 translate-x-0 rounded-full bg-surface shadow-sm transition-transform"
            }
          />
        </span>
        <span className="text-sm text-text-secondary group-hover:text-text-primary">
          {label}
        </span>
      </button>
    );
  },
);
