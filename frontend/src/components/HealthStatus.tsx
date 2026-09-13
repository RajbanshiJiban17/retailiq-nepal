"use client";

import React, { useEffect, useState } from "react";
import { probeBackendHealth, API_BASE_URL } from "@/lib/api";
import { HealthStatus as HealthStatusType, ConnectionState } from "@/types";
import { Activity, AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

export function HealthStatus() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [elapsed, setElapsed] = useState<number>(0);
  const [healthData, setHealthData] = useState<HealthStatusType | null>(null);

  const runHealthCheck = async () => {
    setConnectionState("checking");
    setElapsed(0);
    setHealthData(null);

    try {
      const data = await probeBackendHealth((state, time) => {
        setConnectionState(state);
        setElapsed(time);
      });
      setHealthData(data);
    } catch {
      setConnectionState("failed");
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              FastAPI Backend Connectivity
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Targeting: <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-slate-700 dark:text-slate-300">{API_BASE_URL}</code>
          </p>
        </div>

        <div>
          {connectionState === "checking" && (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
              Probing API... ({elapsed}s)
            </div>
          )}

          {connectionState === "waking_up" && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
              Waking up Render backend... ({elapsed}s)
            </div>
          )}

          {connectionState === "connected" && (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Connected & Healthy ({healthData?.environment})
            </div>
          )}

          {connectionState === "failed" && (
            <button
              onClick={runHealthCheck}
              className="inline-flex items-center gap-2 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
            >
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
              Unreachable. Click to retry
              <RefreshCw className="h-3 w-3 ml-0.5" />
            </button>
          )}
        </div>
      </div>

      {connectionState === "waking_up" && (
        <div className="mt-4 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300/90 border border-amber-200/50">
          <strong>Free Tier Notice:</strong> Render puts inactive instances to sleep. Cold starts take ~30–50 seconds to spin up. Automatic retry is actively running...
        </div>
      )}

      {healthData && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">Service</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{healthData.project_name}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">API Version</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">v{healthData.version}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">Environment</span>
            <span className="capitalize font-medium text-slate-800 dark:text-slate-200">{healthData.environment}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">Uptime</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{healthData.uptime_seconds}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
