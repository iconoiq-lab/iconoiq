import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAnyOn, type FeatureKey } from '@/config/features';

/**
 * Renders children only when the feature is on; otherwise redirects (the page chunk never loads).
 * An array means "any of these": the page is shown while at least one of them is on.
 */
export function FeatureGate({ feature, fallback = '/', children }: { feature: FeatureKey | FeatureKey[]; fallback?: string; children: ReactNode }) {
  return isAnyOn(Array.isArray(feature) ? feature : [feature]) ? <>{children}</> : <Navigate to={fallback} replace />;
}
