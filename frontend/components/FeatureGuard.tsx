import React from 'react';
import { useAuth } from '../services/AuthContext';

export type FeatureKey = 'liveAuction' | 'strategyPrep' | 'leagueAnalytics';

interface FeatureGuardProps {
  feature: FeatureKey;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ feature, fallback, children }) => {
  const { isLoggedIn, hasFeature } = useAuth();
  if (!isLoggedIn || !hasFeature(feature)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
