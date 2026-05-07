// Aggregated English message tree, used to type-augment `IntlMessages`
// in `global.d.ts`. Each domain file becomes a top-level namespace —
// matching the merge done in `src/i18n/request.ts`. Add the next domain
// here when it lands; keep the keys in sync with request.ts so
// runtime + types stay aligned.

import common from "./en/common.json";
import auth from "./en/auth.json";
import topbar from "./en/topbar.json";
import projects from "./en/projects.json";
import projectDetail from "./en/projectDetail.json";
import narratives from "./en/narratives.json";
import preview from "./en/preview.json";
import errors from "./en/errors.json";

type Messages = {
  common: typeof common;
  auth: typeof auth;
  topbar: typeof topbar;
  projects: typeof projects;
  projectDetail: typeof projectDetail;
  narratives: typeof narratives;
  preview: typeof preview;
  errors: typeof errors;
};

export default Messages;
