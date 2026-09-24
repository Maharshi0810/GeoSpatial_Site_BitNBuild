import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LoadingOverlay } from '@/components/LoadingOverlay';

// Route-level code splitting with React.lazy per Section 7 performance requirements
const MapWorkspace = lazy(() =>
  import('@/routes/MapWorkspace').then((module) => ({ default: module.MapWorkspace }))
);
const Reports = lazy(() =>
  import('@/routes/Reports').then((module: any) => ({ default: module.Reports || module.default }))
);
const Privacy = lazy(() =>
  import('@/routes/Privacy').then((module) => ({ default: module.Privacy }))
);
const Terms = lazy(() =>
  import('@/routes/Terms').then((module) => ({ default: module.Terms }))
);
const DevTokens = lazy(() =>
  import('@/routes/DevTokens').then((module) => ({ default: module.DevTokens }))
);
const NotFound = lazy(() =>
  import('@/routes/NotFound').then((module) => ({ default: module.NotFound }))
);

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GeoVista] Route rendering or dynamic import error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 bg-canvas text-ink">
          <div className="max-w-md w-full p-6 rounded-2xl bg-card border border-border shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-ink">Failed to Load View</h2>
            <p className="text-sm text-ink-muted">
              {this.state.error?.message || 'A module or network error prevented this page from loading.'}
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition shadow"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface hover:bg-border text-ink transition border border-border"
              >
                Return to Workspace
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const [siteType, setSiteType] = useState<string>('ev_charging');

  useEffect(() => {
    // Initial warmup ping to ensure Render backend is awake and ready
    fetch('/api/health').catch(() => {
      // Non-blocking background warmup
    });
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-canvas text-ink">
        <Header
          currentCity="Ahmedabad, Gujarat"
          currentSiteType={siteType}
          onSiteTypeChange={setSiteType}
          isMockActive={true}
        />

        <div className="flex-1 flex flex-col relative overflow-hidden">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center bg-canvas">
                  <LoadingOverlay message="Loading route bundle..." />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<MapWorkspace siteType={siteType} onSiteTypeChange={setSiteType} />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/dev/tokens" element={<DevTokens />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
};
