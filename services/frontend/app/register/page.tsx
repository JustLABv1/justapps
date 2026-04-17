'use client';

import { AuthLayout } from '@/components/AuthLayout';
import { Button, Form, Input, Label, Link, Separator, TextField } from '@heroui/react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { fetchApi } from '../../lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, oidcLogin } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  const showOidcLogin = settings.oidcEnabled;

  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
    if (settings.disableRegistration || settings.disableLocalAuth) {
      router.push('/login');
    }
  }, [user, router, settings.disableRegistration, settings.disableLocalAuth]);

  const handleOIDCLogin = () => {
    oidcLogin();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/login');
      } else {
        setError(data.message || 'Registrierung fehlgeschlagen');
      }
    } catch (err) {
      console.error(err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Konto erstellen" subtitle="Registrieren Sie sich für einen neuen Account.">
      <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField isRequired className="w-full" onChange={setEmail}>
          <Label className="text-sm font-medium text-foreground mb-1">E-Mail</Label>
          <Input
            placeholder="E-Mail eingeben"
            type="email"
            className="w-full"
            value={email}
          />
        </TextField>

        <TextField isRequired className="w-full" onChange={setUsername}>
          <Label className="text-sm font-medium text-foreground mb-1">Benutzername</Label>
          <Input
            placeholder="Benutzername wählen"
            className="w-full"
            value={username}
          />
        </TextField>

        <TextField isRequired className="w-full" type="password" onChange={setPassword}>
          <Label className="text-sm font-medium text-foreground mb-1">Passwort</Label>
          <Input
            placeholder="Passwort wählen"
            className="w-full"
            value={password}
          />
        </TextField>

        {error && <p className="text-danger text-sm">{error}</p>}

        <Button
          type="submit"
          isPending={loading}
          className="w-full mt-2"
        >
          {({ isPending }) => isPending ? 'Lädt...' : 'Registrieren'}
        </Button>
      </Form>

      {showOidcLogin && (
        <>
          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted font-medium uppercase">Oder</span>
            <Separator className="flex-1" />
          </div>

          <Button
            onPress={handleOIDCLogin}
            variant="outline"
            className="w-full"
          >
            Mit Single Sign-On anmelden
          </Button>
        </>
      )}

      <div className="mt-6 text-center text-sm">
        <p className="text-muted">
          Haben Sie bereits ein Konto?{' '}
          <Link href="/login" className="text-accent font-medium">
            Anmelden
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
