'use client';

import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
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
        <div className="mx-auto flex min-h-[40vh] w-full max-w-lg items-center p-8">
          <Alert tone="destructive" className="w-full">
            <Alert.Icon />
            <Alert.Title>Ein Fehler ist aufgetreten</Alert.Title>
            <Alert.Description>
              Diese Seite konnte nicht geladen werden. Bitte laden Sie die Seite neu oder versuchen Sie es später erneut.
            </Alert.Description>
            <Alert.Actions>
              <Button
                size="sm"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Seite neu laden
              </Button>
            </Alert.Actions>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
