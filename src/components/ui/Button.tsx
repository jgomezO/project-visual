import { forwardRef, type ButtonHTMLAttributes } from "react";
import { tv, type VariantProps } from "tailwind-variants";

// Custom Button primitive (Prism design system, iter 4h R1). Native
// onClick semantics — not HeroUI's onPress. Use HeroUI Button when you
// need its richer interaction model (long-press, press-and-hold, etc.)
// or its built-in Spinner; use this for plain CTAs and toolbar actions.
const button = tv({
  base:
    "inline-flex items-center justify-center font-medium transition " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
    "focus-visible:outline-primary-500 disabled:opacity-50 disabled:cursor-not-allowed",
  variants: {
    variant: {
      primary: "bg-primary-500 text-white rounded-full hover:bg-primary-600",
      secondary:
        "bg-surface text-text-primary border border-border rounded-full hover:bg-warm-50",
      ghost:
        "bg-transparent text-text-secondary rounded-md hover:bg-warm-50 hover:text-text-primary",
      // Icon-only Aether-style circle. Falls back to scale-100 under
      // prefers-reduced-motion so the lift cue isn't a barrier.
      circular:
        "bg-text-primary text-white rounded-full hover:scale-105 motion-reduce:hover:scale-100",
    },
    size: {
      sm: "px-4 py-2 text-sm gap-1.5",
      md: "px-6 py-2.5 gap-2",
      lg: "px-8 py-3 text-base gap-2",
    },
  },
  compoundVariants: [
    // The circular variant ignores px/py and uses fixed square dimensions.
    { variant: "circular", size: "sm", class: "size-8 p-0" },
    { variant: "circular", size: "md", class: "size-10 p-0" },
    { variant: "circular", size: "lg", class: "size-12 p-0" },
  ],
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant, size, className, type = "button", children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={button({ variant, size, className })}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
