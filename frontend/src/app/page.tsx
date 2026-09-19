"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
      <meta httpEquiv="refresh" content="0; url=/dashboard/" />
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-slate-300">ड्यासबोर्ड खोल्दैछ (Redirecting to Dashboard)...</span>
      </div>
    </div>
  );
}

