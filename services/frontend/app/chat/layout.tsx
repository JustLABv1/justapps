import type { ReactNode } from 'react';

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 w-full overflow-hidden">
      {children}
    </div>
  );
}
