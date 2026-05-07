import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string; locale: string }>;
}

// iter 4g: the standalone narratives list moved into the
// "Narrativas" tab inside /projects/[key]. We keep the URL working
// for any external link or bookmark via a 308 (permanent) redirect —
// browsers and the Next.js router cache the redirect, so subsequent
// hits skip this handler entirely. We don't validate the project key
// here; an invalid key gets a 404 from /projects/[key] one hop later,
// which is the same UX the standalone page used to give.
//
// iter 5 (i18n): include the active locale in the redirect target so
// the browser doesn't take an extra hop through the bare-path
// middleware redirect.
export default async function NarrativesListRedirect({ params }: PageProps) {
  const { key, locale } = await params;
  permanentRedirect(`/${locale}/projects/${key}?view=narratives`);
}
