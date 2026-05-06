// Decorative SVG primitives (Prism design system, iter 4h R1).
//
// Visual personality without imagery — abstract flowing curves that
// suggest movement and continuity, intended to live behind hero
// headers. Color is inherited from the parent via `stroke="currentColor"`,
// so the consumer drives palette choice via a Tailwind text utility on
// the wrapper. Opacity has a sensible default but is fully overridable
// via `className`.
//
// Round 1 ships only `CurvedLines`. A second family
// (e.g. `GeometricPattern`) was scoped out — one decorative voice per
// round keeps the visual language coherent while we accumulate
// stakeholder feedback.

interface DecorativeProps {
  className?: string;
}

// Four staggered cubic-Bezier curves across a wide viewBox. Each path
// crosses its neighbour gently, creating an interleaved-ribbons
// feeling rather than parallel lines. `preserveAspectRatio="none"`
// + `vector-effect="non-scaling-stroke"` is the trick: the geometry
// stretches to fill any container shape but the stroke stays a steady
// 1px regardless of stretch — so the lines look intentional in a tall
// hero, a wide banner, or anything in between.
export function CurvedLines({ className }: DecorativeProps) {
  return (
    <svg
      viewBox="0 0 1200 400"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={[
        "pointer-events-none size-full opacity-[0.08]",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M 0 100 C 200 50 400 150 600 100 S 1000 50 1200 100" />
        <path d="M 0 180 C 300 130 500 230 800 180 S 1100 130 1200 180" />
        <path d="M 0 260 C 250 210 450 310 700 260 S 1050 210 1200 260" />
        <path d="M 0 340 C 350 290 600 390 900 340 S 1100 290 1200 340" />
      </g>
    </svg>
  );
}
