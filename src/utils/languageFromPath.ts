import { resolvePreviewLanguageFromPath } from "./fileLanguageRegistry";

export function languageFromPath(path?: string | null) {
  return resolvePreviewLanguageFromPath(path);
}
