import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Path to the request loader is relative to project root. The plugin
// reads it at build time so RSC server actions and route handlers
// can resolve the active locale + messages.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
};

export default withNextIntl(nextConfig);
