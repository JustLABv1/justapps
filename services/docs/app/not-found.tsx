import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <p className="text-sm font-medium text-fd-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold">
        Documentation page not found
      </h1>
      <p className="mt-3 text-fd-muted-foreground">
        The guide may have moved or is not available in this JustApps release.
      </p>
      <Link className="mt-6 font-medium text-fd-primary underline" href="/">
        Return to documentation
      </Link>
    </main>
  );
}
