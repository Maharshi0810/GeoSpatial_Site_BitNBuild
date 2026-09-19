/**
 * Main Application Shell.
 *
 * Owner: Moksh [M]
 * Role: Core Frontend Shell & Integration Hub
 */

import React, { useState } from 'react';
import MapView from './components/MapView';
import LayerPanel from './components/LayerPanel';
import ScorePanel from './components/ScorePanel';
import { useMapLayers } from './hooks/useMapLayers';
import { useScoreApi } from './hooks/useScoreApi';
import './index.css';

export default function App() {
  const {
    layers,
    activeLayers,
    layerOpacity,
    layerData,
    toggleLayer,
    updateOpacity,
  } = useMapLayers();

  const [selectedLocation, setSelectedLocation] = useState(null);
  const { scoreData, loading, error, fetchScore, clearScore } = useScoreApi();

  const handleMapClick = (location) => {
    // location is { lat, lng } from MapView
    setSelectedLocation(location);
    if (location && location.lat && location.lng) {
      fetchScore(location.lat, location.lng);
    }
  };

  const handleCloseScore = () => {
    setSelectedLocation(null);
    clearScore();
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Top Floating Branding Banner */}
      <header
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 18px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            boxShadow: '0 0 15px rgba(0, 212, 255, 0.4)',
          }}
        >
          📍
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
            SiteReadiness AI
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Gujarat, India</span>
            <span style={{ color: '#00d4ff' }}>•</span>
            <span style={{ color: '#10b981' }}>Live Spatial Engine</span>
          </div>
        </div>
      </header>

      {/* Main MapLibre GL Map Canvas */}
      <MapView
        onMapClick={handleMapClick}
        activeLayers={activeLayers}
        layerData={layerData}
        layerOpacity={layerOpacity}
        selectedLocation={selectedLocation}
      />

      {/* Daksh's Layer Controls — Top Right */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
        <LayerPanel
          layers={layers}
          activeLayers={activeLayers}
          layerOpacity={layerOpacity}
          onToggleLayer={toggleLayer}
          onOpacityChange={updateOpacity}
        />
      </div>

      {/* Hint Toast (visible before first click) */}
      {!selectedLocation && !loading && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            padding: '10px 20px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '9999px',
            fontSize: 13,
            color: '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 16 }}>🎯</span>
          <span>Click anywhere in Gujarat to compute site readiness score</span>
        </div>
      )}

      {/* Moksh's Score & Breakdown Panel — Bottom Left */}
      <ScorePanel
        scoreData={scoreData}
        loading={loading}
        error={error}
        location={selectedLocation}
        onClose={handleCloseScore}
      />
    </div>
  );
}
