'use client';

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-enter">
      {children}
    </div>
  );
}
