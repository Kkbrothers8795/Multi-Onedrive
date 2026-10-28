import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

interface ErrorBoundaryState {
  hasError: boolean;
}

class TelemetryErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    // Silently suppress any telemetry errors on custom VPS or offline environments
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * VPS-Safe Wrapper for Vercel Analytics & Vercel Speed Insights.
 * - Automatically active on Vercel deployments.
 * - Safely guarded with TelemetryErrorBoundary + server-side /_vercel/* 200 OK no-op routes
 *   so deploying the exact same codebase on a custom Linux VPS, Docker, or PM2 never throws errors.
 */
export const VercelTelemetry: React.FC = () => {
  if (typeof window === 'undefined') return null;

  return (
    <TelemetryErrorBoundary>
      <Analytics />
      <SpeedInsights />
    </TelemetryErrorBoundary>
  );
};
