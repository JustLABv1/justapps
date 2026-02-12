'use client';

import { Button, Card, Form, Input, Label, Link, Separator, TextField } from '@heroui/react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, oidcLogin } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
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
      const response = await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/login');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4">
      <Card className="w-full max-w-md p-8 bg-white border border-bund-gray shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-bund-black mb-2">Registrieren</h1>
          <p className="text-sm text-default-500">Erstellen Sie einen neuen Account.</p>
        </div>

        <Form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <TextField isRequired className="w-full" onChange={setEmail}>
            <Label className="text-bund-black font-medium mb-1">Email</Label>
            <Input
              placeholder="E-Mail eingeben"
              type="email"
              className="w-full"
              value={email}
            />
          </TextField>

          <TextField isRequired className="w-full" onChange={setUsername}>
            <Label className="text-bund-black font-medium mb-1">Benutzername</Label>
            <Input
              placeholder="Benutzername wählen"
              className="w-full"
              value={username}
            />
          </TextField>

          <TextField isRequired className="w-full" type="password" onChange={setPassword}>
            <Label className="text-bund-black font-medium mb-1">Passwort</Label>
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
            className="w-full bg-bund-blue text-white font-medium"
          >
            {({ isPending }) => isPending ? 'Lädt...' : 'Registrieren'}
          </Button>
        </Form>
        <div className="my-6 flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-default-400 font-medium uppercase">Oder</span>
          <Separator className="flex-1" />
        </div>

        <Button
          onPress={handleOIDCLogin}
          variant="outline"
          className="w-full border-bund-gray text-bund-black font-medium"
        >
          Mit Keycloak anmelden
        </Button>
        <div className="mt-6 text-center text-sm">
          <p className="text-default-500">
            Haben Sie bereits einen Account?{' '}
            <Link href="/login" className="text-bund-blue font-medium">
              Anmelden
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
