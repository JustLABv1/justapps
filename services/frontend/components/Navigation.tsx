'use client';

import {
    Avatar,
    Button,
    Dropdown,
    Label,
    Link
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="bg-white border-b sticky top-0 z-40 w-full h-16 flex items-center justify-between px-6 lg:px-12">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex flex-col no-underline text-bund-black hover:opacity-80 transition-opacity">
          <p className="font-bold text-lg leading-none pt-1">PLAIN</p>
          <p className="text-[10px] tracking-widest uppercase">App-Store</p>
        </Link>
        <nav className="hidden sm:flex gap-6">
          <Link href="/" className="text-sm font-medium text-bund-blue underline underline-offset-4">
            Marktplatz
          </Link>
          {user?.role === 'admin' && (
            <Link href="/management" className="text-sm font-medium text-default-600 hover:text-bund-blue transition-colors">
              App Management
            </Link>
          )}
          <Link href="#" className="text-sm font-medium text-default-400 cursor-not-allowed">
            Kategorien
          </Link>
          <Link href="#" className="text-sm font-medium text-default-400 cursor-not-allowed">
            Entwickler
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <Dropdown>
            <Button variant="secondary" className="p-0 min-w-0 bg-transparent hover:bg-transparent shadow-none" aria-label="Benutzermenü">
              <Avatar size="sm">
                <Avatar.Fallback>{user.username.slice(0, 2).toUpperCase()}</Avatar.Fallback>
              </Avatar>
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={(key) => key === 'logout' && handleLogout()}>
                <Dropdown.Item id="profile" textValue="Profil">
                  <div className="flex flex-col gap-0.5">
                    <Label className="font-semibold">Angemeldet als</Label>
                    <Label className="text-xs text-default-500">{user.email}</Label>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item id="logout" variant="danger" textValue="Abmelden">
                  <Label>Abmelden</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ) : (
          <div className="flex gap-2">
            <Button onPress={() => router.push('/login')} variant="secondary" size="sm">
              Anmelden
            </Button>
            <Button onPress={() => router.push('/register')} size="sm" className="bg-bund-blue">
              Registrieren
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
