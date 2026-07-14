import fs from "fs";
import path from "path";

/**
 * Resolve `moonpad/.data/<filename>` whether Node's cwd is the Next app root
 * (`moonpad/`) or the monorepo root (`launchpad/`). Without this, `npm run dev`
 * from the wrong folder makes `/api/presales` see an empty treasury index.
 *
 * If **both** `cwd/.data/<file>` and `cwd/moonpad/.data/<file>` exist (common in
 * a monorepo), we prefer `moonpad/.data` so an empty or stale **root** `.data`
 * file cannot shadow the real app data — that broke treasury-only presale listing
 * while `getProgramAccounts` still showed on-chain sales.
 */
export function moonpadDataPath(filename: string): string {
  const directly = path.join(process.cwd(), ".data", filename);
  const nested = path.join(process.cwd(), "moonpad", ".data", filename);
  const monorepoApp = fs.existsSync(
    path.join(process.cwd(), "moonpad", "package.json")
  );

  try {
    const hasDirect = fs.existsSync(directly);
    const hasNested = fs.existsSync(nested);

    if (hasDirect && hasNested) {
      return monorepoApp ? nested : directly;
    }
    if (hasDirect) return directly;
    if (hasNested) return nested;

    if (monorepoApp) return nested;

    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
      ) as { name?: string };
      if (pkg.name === "moonpad") return directly;
    } catch {
      /* no package.json at cwd */
    }

    return monorepoApp ? nested : directly;
  } catch {
    return directly;
  }
}

/** Parent `.data` directory for pooled files (treasury, mint pool, images). */
export function moonpadDataDir(): string {
  return path.dirname(moonpadDataPath("treasury-by-mint.json"));
}
