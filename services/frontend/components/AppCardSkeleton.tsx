import { Card, CardContent, CardFooter, CardHeader } from "@/components/panelui/card";

/** Placeholder in the shape of an AppCard while the catalogue loads. */
export function AppCardSkeleton() {
  return (
    <Card aria-hidden="true" className="h-full animate-pulse motion-reduce:animate-none">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="size-11 shrink-0 rounded-xl bg-muted" />
          <div className="flex flex-1 flex-col gap-2 pt-0.5">
            <div className="h-4 w-3/4 rounded-md bg-muted" />
            <div className="h-3 w-1/2 rounded-md bg-muted" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="mt-3 flex gap-1.5">
          <div className="h-5 w-16 rounded-md bg-muted" />
          <div className="h-5 w-12 rounded-md bg-muted" />
        </div>
      </CardContent>
      <CardFooter variant="panel" className="justify-between">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-8 w-28 rounded-full bg-muted" />
      </CardFooter>
    </Card>
  );
}
