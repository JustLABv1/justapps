'use client';

import { Button, Card, Form, Input, Label, Link, Separator, TextField } from '@heroui/react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, oidcLogin } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleOIDCLogin = () => {
    oidcLogin();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.token, data.user);
        router.push('/');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-12rem)] px-4">
      <Card className="w-full max-w-md" variant="default">
        <Card.Header className="p-6 pb-2 text-center">
          <div className="mb-2">
            <Card.Title className="text-xl font-semibold text-foreground">Anmelden</Card.Title>
            <Card.Description className="text-sm text-muted mt-1">Geben Sie Ihre Zugangsdaten ein, um fortzufahren.</Card.Description>
          </div>
        </Card.Header>

        <Card.Content className="p-6 pt-4">
          <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField isRequired className="w-full" onChange={setEmail}>
              <Label className="text-sm font-medium text-foreground mb-1">Email oder Benutzername</Label>
              <Input
                placeholder="E-Mail eingeben"
                className="w-full"
                value={email}
              />
            </TextField>

            <TextField isRequired className="w-full" type="password" onChange={setPassword}>
              <Label className="text-sm font-medium text-foreground mb-1">Passwort</Label>
              <Input
                placeholder="Passwort eingeben"
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
              {({ isPending }) => isPending ? 'Lädt...' : 'Anmelden'}
            </Button>
          </Form>

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
            Mit Keycloak anmelden
          </Button>

          <div className="mt-5 text-center text-sm">
            <p className="text-muted">
              Noch keinen Account?{' '}
              <Link href="/register" className="text-accent font-medium">
                Registrieren
              </Link>
            </p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
