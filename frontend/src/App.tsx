import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LoadingOverlay } from '@/components/LoadingOverlay';

// Route-level code splitting with React.lazy per Section 7 performance requirements
const MapWorkspace = lazy(() =>
  import('@/routes/MapWorkspace').then((module) => ({ default: module.MapWorkspace }))
);
const Reports = lazy(() =>
  import('@/routes/Reports').then((module) => ({ default: module.Reports }))
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

export const App: React.FC = () => {
  const [siteType, setSiteType] = useState<string>('ev_charging');

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
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center bg-canvas">
                <LoadingOverlay message="Loading route bundle..." />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<MapWorkspace />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/dev/tokens" element={<DevTokens />} />
            </Routes>
          </Suspense>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
};
