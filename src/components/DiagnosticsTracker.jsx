import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  classifyDiagnosticError,
  classifyDiagnosticPage,
  isDiagnosticsEnabled,
  recordDiagnostic,
  sanitizeDiagnosticSource,
} from '../api/diagnostics';

export default function DiagnosticsTracker({ currentUser }) {
  const location = useLocation();

  useEffect(() => {
    if (!currentUser?.id || !isDiagnosticsEnabled()) return;
    const page = classifyDiagnosticPage(location.pathname);
    if (page === 'map') recordDiagnostic('map_view', { page });
  }, [currentUser?.id, location.pathname]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const onError = (event) => {
      if (!isDiagnosticsEnabled()) return;
      recordDiagnostic('app_error', {
        page: classifyDiagnosticPage(window.location.hash.replace(/^#/, '').split('?')[0] || window.location.pathname),
        errorType: classifyDiagnosticError(event.error || event.message),
        source: sanitizeDiagnosticSource(event.filename, event.lineno, event.colno),
      });
    };

    const onUnhandledRejection = (event) => {
      if (!isDiagnosticsEnabled()) return;
      recordDiagnostic('app_error', {
        page: classifyDiagnosticPage(window.location.hash.replace(/^#/, '').split('?')[0] || window.location.pathname),
        errorType: classifyDiagnosticError(event.reason),
        source: '',
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [currentUser?.id]);

  return null;
}
