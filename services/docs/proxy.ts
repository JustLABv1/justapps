import {
  DefaultFormatter,
  createI18nMiddleware,
} from "fumadocs-core/i18n/middleware";
import { i18n } from "@/lib/i18n";

const formatter = {
  ...DefaultFormatter,
  add(url: Parameters<typeof DefaultFormatter.add>[0], locale: string) {
    const next = new URL(url);
    const pathname = url.pathname.replace(/^\/+/, "");
    next.pathname = `${url.basePath}/${locale}${pathname ? `/${pathname}` : ""}`;
    return next;
  },
  remove(url: Parameters<typeof DefaultFormatter.remove>[0]) {
    const next = new URL(url);
    const pathname = url.pathname.split("/").slice(2).join("/");
    next.pathname = `${url.basePath}${pathname ? `/${pathname}` : ""}`;
    return next;
  },
};

export default createI18nMiddleware({ ...i18n, format: formatter });

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
