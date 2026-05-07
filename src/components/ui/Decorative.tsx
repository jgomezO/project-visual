// Decorative SVG primitives (Prism design system, iter 4h R1 + R4).
//
// Visual personality without imagery — abstract geometry that lives
// behind hero headers. Color is inherited from the parent via
// `stroke="currentColor"`, so the consumer drives palette choice via
// a Tailwind text utility on the wrapper. Opacity has a sensible
// default in `CurvedLines` (R1) but is fully driven by the consumer in
// `NarrativePattern` (R4) — see below.
//
// Two voices, on purpose:
//
// - `CurvedLines` (R1, used by /projects topbar): interleaved ribbons
//   suggesting *movement and continuity*. Reads as a project
//   dashboard's pulse — many threads moving forward together.
//
// - `NarrativePattern` (R4, used by /preview wrapper): concentric
//   quarter-circle arcs radiating from the top-right corner. Reads as
//   *broadcast and amplification* — the metaphor for a narrative being
//   shared outward to audiences (board, customer, C-level).
//
// Keeping them visually distinct prevents `/preview` from feeling like
// a re-skin of `/projects` while still anchoring both to the same
// brand vocabulary (currentColor inheritance, non-scaling stroke,
// preserveAspectRatio="none").

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

// Concentric quarter-circle arcs anchored at the top-right corner of
// the viewBox (600, 0). Four arcs at radii 120 / 240 / 360 / 480.
// Reads as broadcast / amplification — appropriate for the public
// narrative preview, which is the surface a PM shares outward.
//
// Unlike `CurvedLines`, no opacity is baked in. The consumer controls
// it via `className`. This is on purpose: NarrativePattern is used in
// exactly one place (NarrativeView) and the opacity needs to vary by
// presentation mode (`opacity-[0.06]` normal → `opacity-[0.04]` in
// presentation), which is awkward to express when a default is
// already in the base classes (Tailwind utility ordering would make
// the override unpredictable). Keep CurvedLines' bake-the-default
// API for general-purpose reuse and accept the divergence here.
export function NarrativePattern({ className }: DecorativeProps) {
  return (
    <svg
      viewBox="0 0 600 400"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={["pointer-events-none size-full", className ?? ""]
        .join(" ")
        .trim()}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M 480 0 A 120 120 0 0 0 600 120" />
        <path d="M 360 0 A 240 240 0 0 0 600 240" />
        <path d="M 240 0 A 360 360 0 0 0 600 360" />
        <path d="M 120 0 A 480 480 0 0 0 600 480" />
      </g>
    </svg>
  );
}
