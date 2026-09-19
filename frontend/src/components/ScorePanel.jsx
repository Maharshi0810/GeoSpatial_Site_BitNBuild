/**
 * ScorePanel Component — Display animated site score, grade, factor breakdowns, and constraints.
 * Owner: Moksh [M]
 */

import React, { useEffect, useState, useRef } from 'react';

const GRADE_THEMES = {
  A: { bg: '#10b981', text: '#022c22', glow: 'rgba(16, 185, 129, 0.4)' },
  B: { bg: '#00d4ff', text: '#083344', glow: 'rgba(0, 212, 255, 0.4)' },
  C: { bg: '#f59e0b', text: '#451a03', glow: 'rgba(245, 158, 11, 0.4)' },
  D: { bg: '#f97316', text: '#431407', glow: 'rgba(249, 115, 22, 0.4)' },
  F: { bg: '#ef4444', text: '#450a0a', glow: 'rgba(239, 68, 68, 0.4)' },
};

const DIMENSION_ICONS = {
  demographics: '👥',
  transportation: '🛣️',
  poi: '📍',
  landuse: '🏙️',
  environment: '🌿',
};

function AnimatedNumber({ targetValue, duration = 900 }) {
  const [current, setCurrent] = useState(0);
  const startTimeRef = useRef(null);

  useEffect(() => {
    startTimeRef.current = null;
    let animationFrameId;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      // Ease-out cubic curve
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * targetValue));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [targetValue, duration]);

  return <span>{current}</span>;
}

export default function ScorePanel({
  scoreData,
  loading = false,
  error = null,
  location = null,
  onClose = null,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!location && !loading && !scoreData) {
    return null;
  }

  const containerStyle = {
    position: 'absolute',
    bottom: 24,
    left: 24,
    zIndex: 25,
    width: '380px',
    maxWidth: 'calc(100vw - 48px)',
    background: 'rgba(15, 23, 42, 0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 212, 255, 0.25)',
    borderRadius: '16px',
    padding: '20px',
    color: '#f8fafc',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 212, 255, 0.15)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '3px solid rgba(0, 212, 255, 0.2)',
              borderTopColor: '#00d4ff',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
              Analyzing Candidate Site...
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Querying spatial indices & scoring layers
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...containerStyle, border: '1px solid rgba(239, 68, 68, 0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              Evaluation Error
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 12 }}>{error}</div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!scoreData) return null;

  const { score = 0, grade = 'C', breakdown = {}, constraints = {} } = scoreData;
  const gradeTheme = GRADE_THEMES[grade] || GRADE_THEMES.C;

  return (
    <div style={containerStyle}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#00d4ff',
            }}
          >
            Site Readiness Score
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {location?.lat ? `${location.lat.toFixed(4)}°N, ${location.lng.toFixed(4)}°E` : 'Gujarat'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: 12,
            }}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '6px',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: 12,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Hero Score Display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: gradeTheme.bg,
              textShadow: `0 0 24px ${gradeTheme.glow}`,
              lineHeight: 1,
            }}
          >
            <AnimatedNumber targetValue={score} />
          </span>
          <span style={{ fontSize: 16, color: '#64748b', fontWeight: 600 }}>/100</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              background: gradeTheme.bg,
              color: gradeTheme.text,
              fontSize: 22,
              fontWeight: 800,
              padding: '2px 14px',
              borderRadius: '8px',
              boxShadow: `0 4px 14px ${gradeTheme.glow}`,
            }}
          >
            {grade}
          </div>
        </div>
      </div>

      {/* Collapsible Factor Breakdown */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Multi-Layer Factor Evaluation
          </div>

          {Object.entries(breakdown).map(([key, val]) => {
            const scoreVal = Math.round(val.score);
            const icon = DIMENSION_ICONS[key] || '📊';

            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{icon}</span>
                    <span>{val.label || key}</span>
                  </span>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{scoreVal}</span>
                </div>

                <div
                  style={{
                    height: 6,
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${scoreVal}%`,
                      background: 'linear-gradient(90deg, #7c3aed 0%, #00d4ff 100%)',
                      borderRadius: 3,
                      transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Constraint Audit Notice */}
          {constraints.in_flood_zone && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚠️</span>
              <span>Point intersects flood risk zone (-35 penalty)</span>
            </div>
          )}

          {constraints.min_road_distance_m > 3000 && (
            <div
              style={{
                marginTop: 6,
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#fde68a',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🛣️</span>
              <span>Isolated site: {Math.round(constraints.min_road_distance_m)}m from road network</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
