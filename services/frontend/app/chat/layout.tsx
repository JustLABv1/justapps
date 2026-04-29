import type { ReactNode } from 'react';

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-my-8 flex h-[calc(100dvh-9rem)] min-h-[480px] flex-col">
      {children}
    </div>
  );
}
