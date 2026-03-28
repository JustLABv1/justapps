'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center text-2xl">
            ⚠️
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">Ein Fehler ist aufgetreten</p>
            <p className="text-sm text-default-500 mt-1 max-w-sm">
              Diese Seite konnte nicht geladen werden. Bitte laden Sie die Seite neu oder versuchen Sie es später erneut.
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            Seite neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
