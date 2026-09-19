/**
 * LayerPanel Component — Manage layer visibility, opacity, and symbology.
 *
 * Owner: Daksh [D]
 */

import React, { useState } from 'react';

export default function LayerPanel({
  layers = [],
  activeLayers = {},
  layerOpacity = {},
  onToggleLayer,
  onOpacityChange
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: isCollapsed ? '10px 16px' : '16px',
        color: '#f8fafc',
        width: '280px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        transition: 'all 0.2s ease-in-out'
      }}
    >
      {/* Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          marginBottom: isCollapsed ? 0 : '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>🗺️</span>
          <span style={{ fontWeight: 600, letterSpacing: '0.3px' }}>Map Layers</span>
        </div>
        <span
          style={{
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            color: '#94a3b8',
            fontSize: '12px'
          }}
        >
          ▼
        </span>
      </div>

      {/* Layer List */}
      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {layers.map((layer) => {
            const isActive = !!activeLayers[layer.id];
            const opacity = layerOpacity[layer.id] ?? 0.8;

            return (
              <div
                key={layer.id}
                style={{
                  background: isActive ? 'rgba(30, 41, 59, 0.7)' : 'rgba(30, 41, 59, 0.3)',
                  border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                  borderRadius: '8px',
                  padding: '10px',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Layer toggle row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={() => onToggleLayer && onToggleLayer(layer.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: layer.color || '#38bdf8',
                        boxShadow: isActive ? `0 0 8px ${layer.color || '#38bdf8'}` : 'none'
                      }}
                    />
                    <span
                      style={{
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? '#f8fafc' : '#94a3b8'
                      }}
                    >
                      {layer.name}
                    </span>
                  </div>

                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => {}} // handled by row click
                    style={{
                      cursor: 'pointer',
                      accentColor: '#38bdf8'
                    }}
                  />
                </div>

                {/* Opacity slider (visible when active) */}
                {isActive && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: '#64748b',
                        marginBottom: '4px'
                      }}
                    >
                      <span>Opacity</span>
                      <span>{Math.round(opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={opacity}
                      onChange={(e) => onOpacityChange && onOpacityChange(layer.id, parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        height: '4px',
                        accentColor: '#38bdf8',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
