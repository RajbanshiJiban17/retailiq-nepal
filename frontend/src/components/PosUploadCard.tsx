import React, { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download, ArrowRight, Sparkles, Lock, LogIn } from "lucide-react";
import { uploadPosCsv, uploadPosSummary, API_BASE_URL } from "@/lib/api";
import { streamParseLargeCsv } from "@/lib/clientEtl";
import { ETLUploadSummary, UserProfile } from "@/types";
import Link from "next/link";

interface PosUploadCardProps {
  businessId?: string;
  currentUser?: UserProfile | null;
  onRequireAuth?: () => void;
  onUploadSuccess?: (summary: ETLUploadSummary) => void;
}

export function PosUploadCard({
  businessId,
  currentUser,
  onRequireAuth,
  onUploadSuccess,
}: PosUploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ percent: number; rows: number; revenue: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ETLUploadSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Determine effective login state and businessId
  const effectiveUser = currentUser ?? (() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("retailiq_user");
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    }
    return null;
  })();

  const effectiveBusinessId =
    effectiveUser?.business_id ||
    businessId ||
    "11111111-1111-1111-1111-111111111111";

  const isLoggedIn = Boolean(effectiveUser);

  const handleFileChange = (selectedFile: File) => {
    if (!isLoggedIn) {
      setError("⚠️ फाइल अपलोड गर्न कृपया पहिले पसल लगइन वा दर्ता गर्नुहोस्। (Please sign in to upload files)");
      if (onRequireAuth) onRequireAuth();
      return;
    }

    const fileName = selectedFile.name.toLowerCase();
    const isAccepted = fileName.endsWith(".csv") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    if (!isAccepted) {
      setError("कृपया Excel (.xlsx, .xls) वा CSV (.csv) फाइल मात्र छान्नुहोस्। (Only Excel and CSV supported)");
      setFile(null);
      return;
    }
    setError(null);
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!isLoggedIn) {
      setError("⚠️ फाइल अपलोड गर्न कृपया पहिले पसल लगइन वा दर्ता गर्नुहोस्। (Please sign in to upload files)");
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!isLoggedIn) {
      setError("⚠️ फाइल अपलोड गर्न कृपया पहिले पसल लगइन वा दर्ता गर्नुहोस्। (Please sign in to upload files)");
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!file) return;
    setUploading(true);
    setError(null);
    setParseProgress(null);

    try {
      let res: ETLUploadSummary;
      const isCsv = file.name.toLowerCase().endsWith(".csv");

      // For large CSV files (> 2MB) or mobile networks, stream parse on device directly
      // This completely bypasses Cloudflare/Render 100-second upload timeouts!
      if (isCsv && file.size > 2 * 1024 * 1024) {
        setParseProgress({ percent: 5, rows: 0, revenue: 0 });
        const localSummary = await streamParseLargeCsv(
          file,
          effectiveBusinessId,
          (percent, rows, rev) => {
            setParseProgress({ percent, rows, revenue: rev });
          }
        );
        setParseProgress({ percent: 100, rows: localSummary.total_rows_processed, revenue: localSummary.total_revenue_npr });
        // Sync the lightweight (~15KB) summary to backend
        res = await uploadPosSummary(localSummary);
      } else {
        try {
          res = await uploadPosCsv(file, effectiveBusinessId);
        } catch (uploadErr: any) {
          // If network timed out or failed and it's a CSV, automatically fall back to fast device stream parse!
          if (isCsv) {
            setParseProgress({ percent: 10, rows: 0, revenue: 0 });
            const localSummary = await streamParseLargeCsv(
              file,
              effectiveBusinessId,
              (percent, rows, rev) => {
                setParseProgress({ percent, rows, revenue: rev });
              }
            );
            setParseProgress({ percent: 100, rows: localSummary.total_rows_processed, revenue: localSummary.total_revenue_npr });
            res = await uploadPosSummary(localSummary);
          } else {
            throw uploadErr;
          }
        }
      }

      setSummary(res);
      // Persist latest ETL summary for dashboard consumption
      try {
        localStorage.setItem(`retailiq_etl_${effectiveBusinessId}`, JSON.stringify(res));
        localStorage.setItem("retailiq_latest_etl", JSON.stringify(res));
        localStorage.setItem("retailiq_analytics_timestamp", new Date().toISOString());
        window.dispatchEvent(new Event("retailiq_data_updated"));
      } catch (storageErr) {
        console.warn("Could not save to localStorage", storageErr);
      }
      if (onUploadSuccess) onUploadSuccess(res);
    } catch (err: any) {
      setError(err.message || "CSV अपलोड तथा प्रोसेसिङ असफल भयो।");
    } finally {
      setUploading(false);
      setParseProgress(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 text-white shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                पसलको बिक्री डाटा अपलोड (Excel .xlsx / CSV Ingestion)
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium border border-emerald-500/30">
                  ETL Pipeline Active
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                IMS, Tally वा Excel (.xlsx, .xls, .csv) बाट निकालिएको बिक्री फाइल यहाँ हाल्नुहोस्।
              </p>
            </div>
          </div>
        </div>

        <a
          href={`${API_BASE_URL}/api/v1/etl/sample-template`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition shadow-sm w-fit"
        >
          <Download className="h-3.5 w-3.5 text-emerald-400" />
          नमुना CSV डाउनलोड (Sample Template)
        </a>
      </div>

      {/* Login Required Warning Banner when Unauthenticated */}
      {!isLoggedIn && (
        <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300 block">पसल लगइन आवश्यक (Login Required)</span>
              <span className="text-[11px] text-amber-200/80">
                बिक्री तथा इन्भेन्टरी CSV/Excel डाटा अपलोड गर्न पहिले आफ्नो पसलको खाता लगइन गर्नुहोस्।
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRequireAuth?.()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 transition shadow-sm shrink-0 w-fit"
          >
            <LogIn className="h-3.5 w-3.5" />
            पहिले लगइन गर्नुहोस्
          </button>
        </div>
      )}

      {/* Drag and Drop Zone */}
      {!summary && (
        <div className="mt-5 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!isLoggedIn) {
                setError("⚠️ फाइल अपलोड गर्न कृपया पहिले पसल लगइन वा दर्ता गर्नुहोस्। (Please login first)");
                if (onRequireAuth) onRequireAuth();
                return;
              }
              fileInputRef.current?.click();
            }}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              !isLoggedIn
                ? "border-amber-500/40 bg-slate-900/50 hover:border-amber-400/60"
                : isDragging
                ? "border-emerald-400 bg-emerald-950/20 scale-[0.99]"
                : file
                ? "border-emerald-500/60 bg-slate-800/50"
                : "border-slate-700 hover:border-slate-600 bg-slate-850/40 hover:bg-slate-800/30"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />

            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border ${
              !isLoggedIn
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-slate-800 text-emerald-400 border-slate-700"
            }`}>
              {!isLoggedIn ? <Lock className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
            </div>

            <p className="mt-3 text-sm font-semibold text-white">
              {!isLoggedIn
                ? "🔒 फाइल अपलोड गर्न पहिले लगइन गर्नुहोस् (Click to Sign In)"
                : file
                ? file.name
                : "यहाँ Excel (.xlsx/.xls) वा CSV फाइल ड्र्याग गर्नुहोस् वा छान्नुहोस्"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {!isLoggedIn
                ? "बिक्री डाटा विश्लेषणका लागि पसलको आधिकारिक खाता आवश्यक पर्दछ"
                : file
                ? `साइज: ${(file.size / 1024).toFixed(1)} KB • अपलोड गर्न तयार`
                : "अधिकतम फाइल साइज: 100MB • ५०MB+ ठूला Excel र CSV द्रुत विश्लेषण • नेपाली रुपैयाँ स्वतः सफा हुन्छ"}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-950/50 border border-rose-800/60 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {uploading && parseProgress && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 animate-pulse text-emerald-400" />
                  मोबाइल / ठूलो फाइल द्रुत विश्लेषण हुँदैछ (Local Streaming Parse)...
                </span>
                <span className="font-mono font-bold text-emerald-400">{parseProgress.percent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${parseProgress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{parseProgress.rows.toLocaleString()} पङ्क्तिहरू विश्लेषण भयो</span>
                <span>कुल कारोबार: Rs. {Math.round(parseProgress.revenue).toLocaleString("en-NP")}</span>
              </div>
            </div>
          )}


          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <span className="text-xs text-slate-400">
              {isLoggedIn ? (
                <>
                  Business Tenant ID: <code className="font-mono text-emerald-400 bg-slate-800 px-1.5 py-0.5 rounded">{effectiveBusinessId.slice(0, 18)}...</code>
                </>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> लगइन गरेपछि मात्र तपाईंको आफ्नै Business ID मा डाटा सुरक्षित हुन्छ
                </span>
              )}
            </span>
            {isLoggedIn ? (
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-40"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    डाटा प्रोसेसिङ हुँदैछ (ETL Cleaning)...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    फाइल विश्लेषण गर्नुहोस् (Analyze & Ingest)
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError("⚠️ फाइल अपलोड गर्न कृपया पहिले पसल लगइन वा दर्ता गर्नुहोस्।");
                  if (onRequireAuth) onRequireAuth();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-5 py-2.5 text-xs font-bold text-amber-300 hover:text-white transition"
              >
                <Lock className="h-4 w-4 text-amber-400" />
                पहिले लगइन गर्नुहोस् (Login Required)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Success Summary View */}
      {summary && (
        <div className="mt-5 space-y-4 rounded-xl bg-slate-850 border border-emerald-500/40 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              डाटा सफलतापूर्वक लोड र विश्लेषण गरियो! (Ingestion Complete)
            </div>
            <button
              onClick={() => { setSummary(null); setFile(null); }}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              अर्को फाइल अपलोड गर्नुहोस्
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">कुल कारोबार (Transactions)</span>
              <span className="text-lg font-black text-white">{summary.valid_rows_count ?? summary.total_rows_processed}</span>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">कुल आम्दानी (Revenue)</span>
              <span className="text-lg font-black text-emerald-400">
                Rs. {(summary.total_revenue_npr || 0).toLocaleString("en-NP")}
              </span>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">सामान / उत्पादनहरू</span>
              <span className="text-lg font-black text-cyan-400">{summary.products_auto_created ?? 0}</span>
            </div>
            <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">त्रुटिपूर्ण हटाइएका</span>
              <span className="text-lg font-black text-amber-400">{summary.invalid_rows_count ?? 0}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-slate-950 font-bold px-4 py-2 text-xs hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
            >
              अपडेटेड ड्यासबोर्ड र ग्राफ हेर्नुहोस् (Open Dashboard)
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
