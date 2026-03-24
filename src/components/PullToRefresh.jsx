import React, { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 55;
const MAX_PULL = 80;

/**
 * Wraps content and shows "pull to refresh" when user pulls down from the top zone.
 * onRefresh is called when user releases after pulling past PULL_THRESHOLD.
 */
export default function PullToRefresh({ onRefresh, loading = false, children, className = '' }) {
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (loading || !onRefresh) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    // Only activate if touch starts in top 60px and center 50% (avoid back/settings buttons)
    if (touch.clientY > 60) return;
    const w = typeof window !== 'undefined' ? window.innerWidth : 400;
    if (touch.clientX < w * 0.25 || touch.clientX > w * 0.75) return;
    startY.current = touch.clientY;
    setIsPulling(true);
  }, [loading, onRefresh]);

  const handleTouchMove = useCallback((e) => {
    if (!isPulling) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    const dy = touch.clientY - startY.current;
    if (dy > 0) {
      e.preventDefault();
      setPullY(Math.min(dy, MAX_PULL));
    }
  }, [isPulling]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling) return;
    if (pullY >= PULL_THRESHOLD && onRefresh) {
      onRefresh();
    }
    setPullY(0);
    setIsPulling(false);
  }, [isPulling, pullY, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ touchAction: isPulling ? 'none' : undefined }}
    >
      {/* Pull indicator - appears above content when pulling */}
      {(pullY > 0 || loading) && (
        <div
          className="absolute left-0 right-0 top-0 z-[1100] flex items-center justify-center overflow-hidden transition-all duration-150"
          style={{
            height: loading ? 48 : Math.min(pullY, MAX_PULL),
            backgroundColor: 'rgba(15, 14, 18, 0.95)',
          }}
        >
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Updating spots…</span>
              </>
            ) : pullY >= PULL_THRESHOLD ? (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Release to refresh</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" style={{ transform: `rotate(${pullY * 2}deg)` }} />
                <span>Pull to refresh</span>
              </>
            )}
          </div>
        </div>
      )}
      {/* Content - shifts down when pulling; flex-1 min-h-0 so map fills remaining space */}
      <div
        className="flex-1 min-h-0 flex flex-col"
        style={{
          transform: pullY > 0 || loading ? `translateY(${Math.min(pullY, MAX_PULL)}px)` : undefined,
          transition: !isPulling && !loading ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
