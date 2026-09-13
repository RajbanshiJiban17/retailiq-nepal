"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download, ArrowRight, Sparkles } from "lucide-react";
import { uploadPosCsv, API_BASE_URL } from "@/lib/api";
import { ETLUploadSummary } from "@/types";
import Link from "next/link";

interface PosUploadCardProps {
  businessId?: string;
  onUploadSuccess?: (summary: ETLUploadSummary) => void;
}

export function PosUploadCard({ businessId = "11111111-1111-1111-1111-111111111111", onUploadSuccess }: PosUploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ETLUploadSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("कृपया केवल CSV (.csv) फाइल मात्र छान्नुहोस्। (Only CSV files supported)");
      setFile(null);
      return;
    }
    setError(null);
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const res: ETLUploadSummary = await uploadPosCsv(file, businessId);
      setSummary(res);
      // Persist latest ETL summary for dashboard consumption
      try {
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
                पसलको बिक्री डाटा अपलोड (POS / Excel CSV Ingestion)
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium border border-emerald-500/30">
                  ETL Pipeline Active
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                IMS, Tally वा Excel बाट निकालिएको दैनिक/मासिक बिलिङ CSV फाइल यहाँ हाल्नुहोस्।
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

      {/* Drag and Drop Zone */}
      {!summary && (
        <div className="mt-5 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? "border-emerald-400 bg-emerald-950/20 scale-[0.99]"
                : file
                ? "border-emerald-500/60 bg-slate-800/50"
                : "border-slate-700 hover:border-slate-600 bg-slate-850/40 hover:bg-slate-800/30"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-emerald-400 border border-slate-700">
              <UploadCloud className="h-6 w-6" />
            </div>

            <p className="mt-3 text-sm font-semibold text-white">
              {file ? file.name : "यहाँ CSV फाइल ड्र्याग गर्नुहोस् वा क्लिक गर्नुहोस् (Drag & Drop or Browse)"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {file
                ? `साइज: ${(file.size / 1024).toFixed(1)} KB • अपलोड गर्न तयार`
                : "अधिकतम फाइल साइज: 10MB • नेपाली रुपैयाँ (Rs. / NPR) स्वतः सफा हुन्छ"}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-950/50 border border-rose-800/60 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-slate-400">
              Business Tenant ID: <code className="font-mono text-emerald-400 bg-slate-800 px-1.5 py-0.5 rounded">{businessId.slice(0, 18)}...</code>
            </span>
            <button
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
