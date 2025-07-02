import React from 'react';
import { useAuth } from '../services/AuthContext';

export type FeatureKey = 'liveAuction' | 'strategyPrep' | 'leagueAnalytics';

interface FeatureGuardProps {
  feature: FeatureKey;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ feature, fallback, children }) => {
  const { isLoggedIn, hasFeature, profile } = useAuth();
  const has = hasFeature(feature);
  console.log('[FeatureGuard] plan:', profile?.plan, 'feature:', feature, 'hasFeature:', has);
  if (!isLoggedIn || !has) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
