/**
 * React hook to invoke /api/score and manage site analysis state.
 * Owner: Moksh [M]
 */

import { useState, useCallback } from 'react';
import { api } from '../utils/api';

export function useScoreApi() {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchScore = useCallback(async (lat, lng, weights = null, site_type = 'ev_charging', sub_filter = null) => {
    setLoading(true);
    setError(null);
    try {
      const payload = { lat, lng, site_type };
      if (weights) payload.weights = weights;
      if (sub_filter) payload.sub_filter = sub_filter;
      const data = await api.post('/api/score', payload);
      setScoreData(data);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to fetch site readiness score');
      setScoreData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearScore = useCallback(() => {
    setScoreData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    scoreData,
    loading,
    error,
    fetchScore,
    clearScore,
  };
}
