"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  checkSessionValidity,
  refreshSessionActivity,
  terminateSession,
} from "@/lib/session";

interface UseSessionTimerOptions {
  enabled: boolean;
  onTimeout?: () => void;
  warningThresholdSeconds?: number; // e.g. 120 (2 minutes)
}

export function useSessionTimer({
  enabled,
  onTimeout,
  warningThresholdSeconds = 120,
}: UseSessionTimerOptions) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);
  const [isExpiringSoon, setIsExpiringSoon] = useState<boolean>(false);
  const lastTouchRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Handler to refresh session activity on user interaction
  const handleUserActivity = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    // Throttle refresh to at most once every 5 seconds to reduce write overhead
    if (now - lastTouchRef.current > 5000) {
      lastTouchRef.current = now;
      refreshSessionActivity();
      const status = checkSessionValidity();
      setRemainingSeconds(status.remainingSeconds);
      setIsExpiringSoon(false);
    }
  }, [enabled]);

  // Attach activity listeners
  useEffect(() => {
    if (!enabled) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
    };
  }, [enabled, handleUserActivity]);

  // Interval ticker every 1 second
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const status = checkSessionValidity();

      if (!status.isValid || status.remainingSeconds <= 0) {
        clearInterval(interval);
        terminateSession("timeout");
        if (onTimeoutRef.current) {
          onTimeoutRef.current();
        }
      } else {
        setRemainingSeconds(status.remainingSeconds);
        setIsExpiringSoon(status.remainingSeconds <= warningThresholdSeconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, warningThresholdSeconds]);

  // Format remaining time into mm:ss
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const extendSession = () => {
    lastTouchRef.current = Date.now();
    refreshSessionActivity();
    const status = checkSessionValidity();
    setRemainingSeconds(status.remainingSeconds);
    setIsExpiringSoon(false);
  };

  return {
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
    isExpiringSoon,
    extendSession,
  };
}
