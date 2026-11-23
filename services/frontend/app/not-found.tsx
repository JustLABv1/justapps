'use client';

import { Button } from '@/components/panelui/button';
import { NotFound } from '@/components/panelui/not-found';
import { ArrowLeft, House } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-12">
      <NotFound>
        <NotFound.Code code="404" effect="scatter" />
        <NotFound.Title>Seite nicht gefunden</NotFound.Title>
        <NotFound.Description>Die angeforderte Seite existiert nicht oder wurde verschoben.</NotFound.Description>
        <NotFound.Actions>
          <Button render={<NextLink href="/" />}>
            <House />
            Zur Startseite
          </Button>
          {/* Back where the reader came from, or home when the page was opened directly. */}
          <Button variant="outline" onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}>
            <ArrowLeft />
            Zurück
          </Button>
        </NotFound.Actions>
      </NotFound>
    </div>
  );
}
