import { Topbar } from "@/components/Topbar";
import { getCurrentUser } from "@/lib/auth/get-current-user";

// Layout for the authenticated half of the product. Wraps every child
// page with the persistent Topbar. /preview lives outside this group
// (under app/projects/[key]/narratives/[id]/preview/) so the public
// shareable view stays chrome-free — same URL, just outside the (app)
// route group, no inheritance of this layout.
//
// Single getCurrentUser() per request: pages under here used to call
// it independently to feed UserMenu; with the menu in the topbar, we
// fetch once at the layout boundary and the pages stop bothering.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  return (
    <>
      <Topbar user={currentUser} />
      {children}
    </>
  );
}
