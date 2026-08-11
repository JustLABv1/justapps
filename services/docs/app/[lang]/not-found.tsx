import Link from "next/link";

type NotFoundProps = Readonly<{
  params?: Promise<{ lang: string }>;
}>;

export default async function NotFound({ params }: NotFoundProps) {
  const { lang } = (await params) ?? { lang: "de" };
  const isGerman = lang === "de";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <p className="text-sm font-medium text-fd-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold">
        {isGerman
          ? "Dokumentationsseite nicht gefunden"
          : "Documentation page not found"}
      </h1>
      <p className="mt-3 text-fd-muted-foreground">
        {isGerman
          ? "Die Anleitung wurde möglicherweise verschoben oder ist in dieser JustApps-Version nicht verfügbar."
          : "The guide may have moved or is not available in this JustApps release."}
      </p>
      <Link
        className="mt-6 font-medium text-fd-primary underline"
        href={isGerman ? "/" : "/en"}
      >
        {isGerman ? "Zur Dokumentation" : "Return to documentation"}
      </Link>
    </main>
  );
}
