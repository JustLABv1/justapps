import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const contentRoot = path.resolve("content/docs");

async function getMdxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return getMdxFiles(filePath);
      return entry.isFile() && entry.name.endsWith(".mdx") ? [filePath] : [];
    }),
  );

  return nested.flat();
}

function routeFor(filePath) {
  const relative = path
    .relative(contentRoot, filePath)
    .replace(/\.mdx$/, "")
    .replace(/\.(?:de|en|\$)$/, "");
  if (relative === "index") return "/";
  if (relative.endsWith("/index")) {
    return `/${relative.slice(0, -"/index".length)}`;
  }
  return `/${relative}`;
}

function localeFor(filePath) {
  const relative = path.relative(contentRoot, filePath).replace(/\.mdx$/, "");
  return relative.match(/\.(de|en|\$)$/)?.[1] ?? "de";
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function headingsFor(content) {
  return new Set(
    [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) =>
      slugify(match[1]),
    ),
  );
}

const files = await getMdxFiles(contentRoot);
const pages = new Map();

for (const filePath of files) {
  const content = await readFile(filePath, "utf8");
  const locale = localeFor(filePath);
  const page = { filePath, headings: headingsFor(content) };
  pages.set(`${locale}:${routeFor(filePath)}`, page);
  if (locale === "$") {
    pages.set(`de:${routeFor(filePath)}`, page);
    pages.set(`en:${routeFor(filePath)}`, page);
  }
}

const failures = [];
for (const filePath of files) {
  const content = await readFile(filePath, "utf8");
  const fileLocale = localeFor(filePath);
  const locale = fileLocale === "de" ? "de" : "en";
  for (const match of content.matchAll(/\]\((\/[^)\s]+)\)/g)) {
    const target = match[1];
    // These are links into the JustApps frontend, not documentation routes.
    // They are intentionally allowed here because the docs explain where the
    // corresponding admin and creator workflows live in the product.
    if (
      target.startsWith("/api/") ||
      target.startsWith("/docs/") ||
      target === "/verwaltung" ||
      target.startsWith("/verwaltung/") ||
      target === "/apps" ||
      target.startsWith("/apps/") ||
      target === "/meine-apps" ||
      target.startsWith("/meine-apps/") ||
      target === "/login" ||
      target === "/register"
    )
      continue;

    const [route, fragment] = target.split("#");
    const page = pages.get(`${locale}:${route || "/"}`);
    if (!page) {
      failures.push(
        `${path.relative(process.cwd(), filePath)} links to missing route ${target}`,
      );
      continue;
    }
    if (fragment && !page.headings.has(slugify(decodeURIComponent(fragment)))) {
      failures.push(
        `${path.relative(process.cwd(), filePath)} links to missing heading ${target}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation link validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${pages.size} localized documentation routes and internal MDX links.`,
  );
}
