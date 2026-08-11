import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { DocsBrand } from "@/components/docs-brand";

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/JustLABv1/justapps",
    nav: {
      title: DocsBrand,
      url: locale === "de" ? "/" : `/${locale}`,
    },
  };
}
