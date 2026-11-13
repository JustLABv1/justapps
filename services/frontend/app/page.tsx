"use client";

import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppCardSkeleton } from "@/components/AppCardSkeleton";
import { AppGrid } from "@/components/AppGrid";
import { AppStoreGate } from "@/components/AppStoreGate";
import { AppConfig } from "@/config/apps";
import { useSettings } from "@/context/SettingsContext";
import { canOverseeSpaces } from "@/lib/permissions";
import { fetchApi } from "@/lib/api";
import { resolveHeroTitleColors } from "@/lib/branding";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Plus, Rocket } from "lucide-react";
import { useTheme } from "next-themes";
import { Suspense, useEffect, useState } from "react";

export const dynamic = "force-dynamic";

async function getApps(spaceId: string) {
  try {
    const res = await fetchApi(
      spaceId ? `/apps?spaceId=${encodeURIComponent(spaceId)}` : "/apps",
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Error in getApps:", e);
    return [];
  }
}

function HomeLoadingState() {
  return (
    <div className="flex flex-col gap-10 pb-16" aria-busy="true">
      <section className="mt-2 flex flex-col items-center gap-4 rounded-2xl border bg-muted/50 px-6 py-10 animate-pulse motion-reduce:animate-none">
        <div className="h-6 w-48 rounded-full bg-muted" />
        <div className="h-9 w-full max-w-xl rounded-xl bg-muted" />
        <div className="h-4 w-full max-w-lg rounded-full bg-muted" />
      </section>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <AppCardSkeleton key={index} />
        ))}
      </section>
    </div>
  );
}

function HomeContent() {
  const { theme } = useTheme();
  const { user, profileReady } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const spaceId = searchParams.get("spaceId") || "";
  const [spaces, setSpaces] = useState<
    { id: string; name: string; accepted: boolean }[]
  >([]);
  const { settings } = useSettings();
  const catalogKey = `${user?.id || "guest"}:${profileReady}:${spaceId}`;
  const [loadedCatalogKey, setLoadedCatalogKey] = useState("");
  const [spaceCreationAccess, setSpaceCreationAccess] = useState<{ userId: string; canCreate: boolean } | null>(null);
  const [spacesUserId, setSpacesUserId] = useState("");
  const visibleSpaces = spacesUserId === user?.id ? spaces : [];
  const showSpaceSwitcher = profileReady && !!user && (
    visibleSpaces.length > 0 ||
    canOverseeSpaces(user.role, user.permissions) ||
    (spaceCreationAccess?.userId === user.id && spaceCreationAccess.canCreate)
  );
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isDark = theme === "dark";

  const heroBadge = spaceId
    ? "Privater Space"
    : settings.heroBadge || "Open Source. Community-getrieben.";
  const heroTitle = spaceId
    ? visibleSpaces.find((space) => space.id === spaceId)?.name ||
      "Privater Space"
    : settings.heroTitle || "Der App Store für alle.";
  const heroSubtitle = spaceId
    ? "Apps für Sie und die Mitglieder dieses Spaces. Nur berechtigte Nutzer haben Zugriff."
    : settings.heroSubtitle ||
      "Entdecken Sie Open-Source-Apps, cloud-native Lösungen und community-entwickelte Tools – frei zugänglich für jeden.";
  const heroTitleColors = resolveHeroTitleColors(
    settings.heroTitlePreset,
    settings.heroTitleColors,
  );
  const heroTitleGradient = `linear-gradient(90deg, ${heroTitleColors.join(", ")})`;

  useEffect(() => {
    let active = true;
    getApps(spaceId).then((appsData) => {
      if (active) {
        setApps(appsData);
        setLoadedCatalogKey(catalogKey);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [spaceId, catalogKey]);

  useEffect(() => {
    if (!user || !profileReady) return;
    let active = true;
    void fetchApi("/spaces")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (active) {
          setSpacesUserId(user.id);
          setSpaces(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, profileReady]);

  useEffect(() => {
    if (!user || !profileReady) return;
    let active = true;
    void fetchApi("/spaces/creation-policy")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (active) setSpaceCreationAccess({ userId: user.id, canCreate: data.canCreate === true });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user, profileReady]);

  if (isLoading || loadedCatalogKey !== catalogKey) return <HomeLoadingState />;

  return (
    <div className="flex flex-col gap-10 pb-16">
      {/* Hero section */}
      <section className="mt-2 flex flex-col items-center gap-3 rounded-2xl border bg-muted/50 px-6 py-10 text-center">
        <Badge variant="outline" size="lg" className="bg-background">
          <Rocket className="text-success" />
          {heroBadge}
        </Badge>

        <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          <span
            className={`inline-block bg-clip-text text-transparent ${isDark ? "drop-shadow-[0_0_1px_rgba(255,255,255,0.5)]" : ""}`}
            style={{ backgroundImage: heroTitleGradient }}
          >
            {heroTitle}
          </span>
        </h1>

        <p className="max-w-2xl text-base text-pretty text-muted-foreground">
          {heroSubtitle}
        </p>
      </section>

      <div id="all-apps" className="scroll-mt-8">
        <Suspense
          fallback={<div className="h-64 animate-pulse rounded-2xl border bg-muted/50" />}
        >
          <AppGrid
            key={spaceId || "public"}
            initialApps={apps}
            spaceId={spaceId}
            catalogAction={
              profileReady && user && (user.role === "admin" || user.canSubmitApps) && (!spaceId || visibleSpaces.some((space) => space.id === spaceId)) ? (
            <Button size="sm" variant="outline" onClick={() => router.push(spaceId ? `/meine-apps/new?spaceId=${encodeURIComponent(spaceId)}` : "/meine-apps/new")}>
              <Plus />
              App erstellen
            </Button>
              ) : undefined
            }
            scopeControl={
              showSpaceSwitcher && user ? (
                <SpaceSwitcher
                  spaces={visibleSpaces.filter((space) => space.accepted)}
                  invitationCount={visibleSpaces.filter((space) => !space.accepted).length}
                  spaceId={spaceId}
                  canCreate={!!user.canSubmitApps || user.role === "admin"}
                  onChange={(nextId) => {
                    if (nextId === spaceId) return;
                    setIsLoading(true);
                    setApps([]);
                    router.replace(
                      nextId ? `/?spaceId=${encodeURIComponent(nextId)}` : "/",
                      { scroll: false },
                    );
                  }}
                />
              ) : undefined
            }
          />
        </Suspense>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AppStoreGate>
      <Suspense fallback={<HomeLoadingState />}>
        <HomeContent />
      </Suspense>
    </AppStoreGate>
  );
}
