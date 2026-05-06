import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { tv } from "tailwind-variants";

// Aether-style circular action button — the strong visual "→ open" cue
// used in the bottom-right of cards. Strictly icon-only; aria-label is
// required at the type level so screen readers don't get an unlabeled
// button.
//
// When wrapped inside a stretched-link card surface (the /projects
// pattern), pass `tabIndex={-1}` and `aria-hidden="true"` so the button
// stays purely decorative and the surrounding link owns keyboard focus
// and the click target. Otherwise wire `onClick` and treat it as a
// regular button.
const actionButton = tv({
  base:
    "inline-flex size-10 items-center justify-center rounded-full " +
    "bg-text-primary text-white shadow-sm transition " +
    "hover:scale-105 hover:shadow-md motion-reduce:hover:scale-100 " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
    "focus-visible:outline-primary-500 disabled:opacity-50 disabled:cursor-not-allowed",
});

export interface ActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  "aria-label": string;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton({ className, type = "button", children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={actionButton({ className })}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
