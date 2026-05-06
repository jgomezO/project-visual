import { forwardRef, type HTMLAttributes } from "react";
import { tv, type VariantProps } from "tailwind-variants";

// Functional chip primitive (Prism design system, iter 4h R1).
// Non-interactive by default — renders <span>. Wrap in a Link or a
// button if you need interactivity; the surrounding wrapper carries
// the hit-target semantics, the chip just paints.
const chip = tv({
  base: "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
  variants: {
    variant: {
      // Status chips (Jira state buckets)
      "status-todo": "bg-warm-100 text-warm-700",
      "status-progress": "bg-cool-100 text-cool-700",
      "status-done": "bg-success-bg text-success",
      // Severity chips (narrative risks)
      "severity-high": "bg-error-bg text-error",
      "severity-medium": "bg-warning-bg text-warning",
      "severity-low": "bg-cool-100 text-cool-700",
      // Generic accent (lavender) — used by the narratives badge on /projects
      accent: "bg-primary-100 text-primary-700",
      // Quiet variant for "0 of X" or absence-of-data cases
      muted: "bg-warm-50 text-text-muted",
    },
  },
  defaultVariants: {
    variant: "accent",
  },
});

export type ChipProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof chip>;

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { variant, className, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={chip({ variant, className })} {...rest}>
      {children}
    </span>
  );
});
