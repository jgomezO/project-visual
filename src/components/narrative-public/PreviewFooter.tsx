// Plain-text footer for the public preview. Deliberately NOT a link:
// the public preview is the only surface served to external audiences
// (board, customer, C-level), and every internal route is auth-gated
// by middleware. A "Creado con Prism" link would either point at an
// auth wall or leak the existence of /projects to outsiders. Keeping
// the footer as text-only avoids both.
//
// Hidden in print (data-print="hide") because it carries no operational
// information and would just consume page-bottom margin.
export function PreviewFooter() {
  return (
    <footer
      data-print="hide"
      className="mx-auto mt-4 max-w-[1200px] px-4 pb-8 text-center text-xs text-text-muted sm:px-6"
    >
      <span>Creado con Prism · Veevart</span>
    </footer>
  );
}
