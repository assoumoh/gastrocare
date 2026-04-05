/**
 * ErrorBoundary.tsx
 * Capture les erreurs React non gérées.
 * Affiche un écran de fallback propre au lieu d'un écran blanc.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
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
    // En dev uniquement — pas de données médicales en prod
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {this.props.fallbackTitle || 'Une erreur est survenue'}
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-sm">
            Ce module a rencontré un problème. Vos données sont en sécurité.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-left bg-slate-100 rounded p-3 mb-4 max-w-md overflow-auto text-red-700">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Version globale — pour toute l'app (plein écran) */
export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('GlobalErrorBoundary caught:', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">GastroCare Pro</h1>
          <p className="text-slate-500 mb-2">L'application a rencontré un problème inattendu.</p>
          <p className="text-sm text-slate-400 mb-8">Vos données sont en sécurité — rechargez la page.</p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-left bg-slate-100 rounded p-3 mb-6 max-w-lg overflow-auto text-red-700">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
