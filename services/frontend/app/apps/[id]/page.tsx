'use client';

import { AppDetail } from "@/components/app-detail/AppDetail";
import { AppStoreGate } from "@/components/AppStoreGate";
import { useParams } from "next/navigation";

export default function AppPage() {
  const params = useParams();
  const id = params?.id as string;
  return (
    <AppStoreGate>
      <AppDetail key={id} id={id} />
    </AppStoreGate>
  );
}
