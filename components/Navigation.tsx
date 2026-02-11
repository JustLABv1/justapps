'use client';

import {
  Header,
  Link
} from "@heroui/react";

export function Navigation() {
  return (
    <Header className="bg-white border-b sticky top-0 z-40 w-full h-16 flex items-center justify-between px-6 lg:px-12">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex flex-col no-underline text-bund-black hover:opacity-80 transition-opacity">
          <p className="font-bold text-lg leading-none pt-1">PLAIN</p>
          <p className="text-[10px] tracking-widest uppercase">App-Store</p>
        </Link>
        <nav className="hidden sm:flex gap-6">
          <Link href="/" className="text-sm font-medium text-bund-blue underline underline-offset-4">
            Marktplatz
          </Link>
          <Link href="#" isDisabled className="text-sm font-medium text-default-600 hover:text-bund-blue transition-colors">
            Kategorien
          </Link>
          <Link href="#" isDisabled className="text-sm font-medium text-default-600 hover:text-bund-blue transition-colors">
            Entwickler
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
      </div>
    </Header>
  );
}
