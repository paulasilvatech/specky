/**
 * Canonical kebab-case slugification for feature directory names.
 *
 * Single source of truth so sdd_init, sdd_write_spec, sdd_turnkey_spec, and the
 * transcript pipeline all derive identical directory names. Previously each call
 * site rolled its own `.replace(/\s+/g, "-")` variant — some stripped special
 * characters, some did not — which forked a feature's package across two
 * directories (e.g. `001-user-auth` vs `001-user-authentication`) and stalled
 * phase advancement.
 */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "feature"
  );
}

/** Build the canonical `NNN-slug` feature directory base name. */
export function featureDirName(featureNumber: string, name: string): string {
  return `${featureNumber}-${slugify(name)}`;
}
