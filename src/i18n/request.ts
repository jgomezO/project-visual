import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Server-side message loader. Called once per request by next-intl
// for Server Components + the NextIntlClientProvider in [locale]/layout.
//
// Messages are split across eight domain files (auth, topbar, etc.)
// and merged into a single object before being handed off. The merge
// happens here (and not at consumer sites) so call sites can do a
// single `useTranslations('topbar')` namespace lookup without juggling
// multiple providers.
//
// Files are imported via dynamic import so the bundler can split per
// locale: requests for `/es/...` only load the Spanish JSON tree.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [
    common,
    auth,
    topbar,
    projects,
    projectDetail,
    narratives,
    preview,
    errors,
  ] = await Promise.all([
    import(`../../messages/${locale}/common.json`),
    import(`../../messages/${locale}/auth.json`),
    import(`../../messages/${locale}/topbar.json`),
    import(`../../messages/${locale}/projects.json`),
    import(`../../messages/${locale}/projectDetail.json`),
    import(`../../messages/${locale}/narratives.json`),
    import(`../../messages/${locale}/preview.json`),
    import(`../../messages/${locale}/errors.json`),
  ]);

  return {
    locale,
    messages: {
      common: common.default,
      auth: auth.default,
      topbar: topbar.default,
      projects: projects.default,
      projectDetail: projectDetail.default,
      narratives: narratives.default,
      preview: preview.default,
      errors: errors.default,
    },
  };
});
