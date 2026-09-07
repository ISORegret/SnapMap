export function navigateBackOr(navigate, fallback = '/') {
  if (typeof navigate !== 'function') return;
  const historyIndex = typeof window !== 'undefined' ? Number(window.history?.state?.idx) : 0;
  if (Number.isFinite(historyIndex) && historyIndex > 0) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
}
