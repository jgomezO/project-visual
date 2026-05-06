import { forwardRef, type HTMLAttributes } from "react";
import { tv, type VariantProps } from "tailwind-variants";

// Custom Card primitive (Prism design system, iter 4h R1). Sits next to
// HeroUI's Card — we use HeroUI for compound use cases that need its
// Card.Header / Card.Title / Card.Description sub-API; this primitive
// is for the simpler "rounded surface with content" case where we want
// full control over padding, radius, and shadow tokens.
const card = tv({
  base: "bg-surface text-text-primary",
  variants: {
    variant: {
      default: "rounded-2xl shadow-md p-6",
      hero: "rounded-3xl shadow-lg p-8",
      compact: "rounded-xl shadow-sm p-4",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type CardProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof card>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant, className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={card({ variant, className })} {...rest}>
      {children}
    </div>
  );
});
