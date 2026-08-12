export type RepositoryMarkdownContext = {
  providerType?: string;
  projectWebUrl?: string;
  branch?: string;
  readmePath?: string;
};

const MARKDOWN_PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeRepositoryPath(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(decodePathSegment(segment)))
    .join("/");
}

function normalizeRepositoryPath(readmePath: string, targetPath: string): string {
  const normalizedReadmePath = readmePath
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
  if (!targetPath) return normalizedReadmePath;

  const readmeSegments = normalizedReadmePath
    .split("/")
    .filter(Boolean)
    .slice(0, -1);
  const targetSegments = targetPath
    .replaceAll("\\", "/")
    .split("/");
  const segments = targetPath.startsWith("/") ? [] : [...readmeSegments];

  for (const rawSegment of targetSegments) {
    const segment = decodePathSegment(rawSegment);
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.filter(Boolean).join("/");
}

function splitMarkdownHref(href: string): { path: string; suffix: string } {
  const match = href.match(/^([^?#]*)([?#].*)?$/);
  return {
    path: match?.[1] || "",
    suffix: match?.[2] || "",
  };
}

function buildRepositoryFileUrl(
  filePath: string,
  context: RepositoryMarkdownContext,
): string | null {
  const projectWebUrl = context.projectWebUrl?.trim();
  const branch = context.branch?.trim() || "HEAD";
  if (!projectWebUrl || !filePath) return null;

  let projectUrl: URL;
  try {
    projectUrl = new URL(projectWebUrl);
  } catch {
    return null;
  }

  if (projectUrl.protocol !== "http:" && projectUrl.protocol !== "https:") {
    return null;
  }

  projectUrl.search = "";
  projectUrl.hash = "";
  const projectPath = projectUrl.toString().replace(/\/$/, "");
  const branchPath = encodeRepositoryPath(branch);
  const repositoryFilePath = encodeRepositoryPath(filePath);
  const providerType = context.providerType?.toLowerCase() === "github"
    ? "github"
    : "gitlab";
  const fileRoute = providerType === "github" ? "blob" : "-/blob";

  return `${projectPath}/${fileRoute}/${branchPath}/${repositoryFilePath}`;
}

/**
 * Resolve a relative Markdown link against the repository file that supplied
 * the Markdown. Absolute URLs, protocol-relative URLs, and page fragments are
 * intentionally left untouched.
 */
export function resolveRepositoryMarkdownLink(
  href: string | undefined,
  context: RepositoryMarkdownContext,
): string | undefined {
  if (!href) return href;

  const trimmedHref = href.trim();
  if (
    !trimmedHref ||
    trimmedHref.startsWith("#") ||
    trimmedHref.startsWith("//") ||
    MARKDOWN_PROTOCOL_PATTERN.test(trimmedHref)
  ) {
    return href;
  }

  const { path: targetPath, suffix } = splitMarkdownHref(trimmedHref);
  const filePath = normalizeRepositoryPath(
    context.readmePath?.trim() || "README.md",
    targetPath,
  );
  const repositoryUrl = buildRepositoryFileUrl(filePath, context);
  return repositoryUrl ? `${repositoryUrl}${suffix}` : href;
}
