# Production Deployment Guide - RetailIQ Nepal 🇳🇵

Complete step-by-step operational guide for deploying **RetailIQ Nepal** on a **Zero-Budget Production Architecture**:
- **Backend & Database**: **Render** (Free Docker Web Service with WeasyPrint GTK system libraries + Free Managed PostgreSQL in Singapore cluster).
- **Frontend**: **Vercel** (Next.js 14 App Router on Vercel Global Edge Network).
- **AI Engine**: **Google Gemini 3.6 Flash** (Free tier via Google AI Studio).
- **Cost**: **$0.00 / month forever**.

---

## 📋 Architecture & Resource Allocation

```
┌──────────────────────────────────────────────────────────┐
│                   Vercel Edge Network                    │
│      https://retailiq-nepal.vercel.app (Next.js 14)      │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTPS REST API Requests
                             ▼
┌──────────────────────────────────────────────────────────┐
│              Render Singapore Region (Docker)             │
│      https://retailiq-nepal-api.onrender.com (FastAPI)   │
│  - 512MB RAM / 0.1 CPU (Free Tier)                       │
│  - WeasyPrint PDF Compiler (Pango/Cairo Linux GTK)       │
│  - SlowAPI Rate Limiting (Brute-force & Abuse Shield)    │
│  - Scikit-Learn Demand Forecaster                        │
└──────────────┬────────────────────────────┬──────────────┘
               │ Internal SSL               │ External REST
               ▼                            ▼
┌──────────────────────────────┐ ┌─────────────────────────┐
│     Render PostgreSQL        │ │   Google Gemini 3.6     │
│   (1GB Storage, Free Tier)   │ │  Flash (Bajar ko Sathi) │
└──────────────────────────────┘ └─────────────────────────┘
```

---

## 🛠️ Prerequisites & Free Accounts Needed

Before deploying, ensure you have free accounts on:
1. **GitHub** ([github.com](https://github.com)): Repository host.
2. **Render** ([render.com](https://render.com)): Free PostgreSQL & Docker backend hosting.
3. **Vercel** ([vercel.com](https://vercel.com)): Free Next.js edge hosting.
4. **Google AI Studio** ([aistudio.google.com](https://aistudio.google.com/)): Free Gemini API key.
5. **UptimeRobot** ([uptimerobot.com](https://uptimerobot.com)): Free keepalive ping (mitigates cold starts).

---

## Phase 1: Provision Render Managed PostgreSQL Database

1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\rightarrow$ **PostgreSQL**.
3. Fill in the database details:
   - **Name**: `retailiq-nepal-db`
   - **Database**: `retailiq_nepal`
   - **User**: `retailiq_admin`
   - **Region**: `Singapore (Southeast Asia)` *(Crucial: lowest network latency to Nepal)*
   - **PostgreSQL Version**: `16`
   - **Instance Type**: `Free`
4. Click **Create Database**.
5. Once provisioned (approx. 60 seconds), copy the **Internal Database URL** (for Render web service) and **External Database URL** (for local migrations/seeds).
   > **Note**: Render PostgreSQL URLs start with `postgres://`. The RetailIQ FastAPI backend automatically converts this to `postgresql+asyncpg://` at runtime.

---

## Phase 2: Deploy Backend Docker Web Service on Render

### Option A: Automatic Blueprint Deployment (Recommended)
1. Push your project repository to GitHub.
2. In Render, click **New +** $\rightarrow$ **Blueprint**.
3. Connect your GitHub repository (`retailiq-nepal`).
4. Render will automatically detect the root [`render.yaml`](file:///c:/Users/User/Desktop/Smart%20Inventory/retailiq-nepal/render.yaml) file.
5. In the blueprint review:
   - Enter your `GEMINI_API_KEY` (from Google AI Studio).
   - Render will automatically provision both the Database and Docker Web Service with linked environment variables.
6. Click **Apply**.

### Option B: Manual Web Service Setup
1. In Render, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the following settings:
   - **Name**: `retailiq-nepal-api`
   - **Region**: `Singapore`
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker` *(Do NOT choose Python runtime; Docker is required for WeasyPrint's Pango/Cairo GTK dependencies)*
   - **Dockerfile Path**: `Dockerfile`
   - **Instance Type**: `Free`
4. Expand **Advanced** $\rightarrow$ **Health Check Path**: `/api/v1/health`
5. Under **Environment Variables**, add:
   | Key | Value / Source |
   | :--- | :--- |
   | `ENVIRONMENT` | `production` |
   | `DEBUG` | `false` |
   | `PORT` | `8000` |
   | `PYTHONUNBUFFERED` | `1` |
   | `DATABASE_URL` | *Paste Render Internal Database URL* |
   | `SECRET_KEY` | *Generate random 64-character hex key* |
   | `JWT_ALGORITHM` | `HS256` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES`| `1440` |
   | `GEMINI_API_KEY` | *Your Gemini API Key* |
   | `GEMINI_MODEL` | `gemini-3.6-flash` |
   | `BACKEND_CORS_ORIGINS` | `["https://retailiq-nepal.vercel.app","http://localhost:3000"]` |
6. Click **Create Web Service**. Wait 3–4 minutes for the Docker image to build and deploy.

---

## Phase 3: Database Schema Migration & Tenant Seeding

Once the database is running, apply the initial schema and demo supermarket data:

### From Your Local Machine (Using External Database URL):
```powershell
# In PowerShell:
$env:DATABASE_URL = "postgresql://retailiq_admin:<PASSWORD>@<EXTERNAL_HOST>.singapore-postgres.render.com/retailiq_nepal?sslmode=require"
python backend/scripts/init_db.py
```

### Alternatively via Render Shell:
1. In Render Dashboard, navigate to `retailiq-nepal-api` $\rightarrow$ **Shell**.
2. Run:
   ```bash
   python scripts/init_db.py
   ```
3. Output confirmation:
   ```text
   [SUCCESS] Initialized RetailIQ database tables and seeded Pashupati Kirana tenant!
   ```

---

## Phase 4: Deploy Frontend on Vercel

1. Log in to [Vercel Dashboard](https://vercel.com/).
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your GitHub repository (`retailiq-nepal`).
4. In the configuration modal:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click `Edit` and select `frontend`.
   - **Build Command**: `npm run build` (Default)
   - **Output Directory**: `.next` (Default)
5. Expand **Environment Variables** and add:
   | Key | Value |
   | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://retailiq-nepal-api.onrender.com` *(Your Render backend URL)* |
6. Click **Deploy**.
7. In ~60 seconds, your site will be live at `https://retailiq-nepal.vercel.app`.

---

## Phase 5: Eliminate Cold Starts (Free Keepalive Strategy)

Render free-tier web services sleep after **15 minutes** of inactivity, taking ~50 seconds to wake up on the next request.

To ensure instant responsiveness for store owners during Nepalese business hours:

1. Create a free account at [UptimeRobot](https://uptimerobot.com/) or [Cron-Job.org](https://cron-job.org/).
2. Add a new **HTTP(s) Monitor**:
   - **Friendly Name**: `RetailIQ Backend Keepalive`
   - **URL**: `https://retailiq-nepal-api.onrender.com/api/v1/health`
   - **Monitoring Interval**: Every **14 minutes** *(Prevents the 15-minute inactivity timer from firing)*
3. **Result**: Your FastAPI backend remains active in memory 24/7 with zero cold starts, completely within the free tier!

---

## Phase 6: Post-Deployment Smoke Test Checklist

Test each completed subsystem against the live production URLs:

| # | Subsystem | Test Action | Expected Result |
| :- | :--- | :--- | :--- |
| 1 | **System Health** | `GET https://<render-url>/api/v1/health` | `HTTP 200` with `status: "healthy"` and uptime |
| 2 | **JWT Auth** | `POST https://<render-url>/api/v1/auth/demo-token` | `HTTP 200` with signed JWT token |
| 3 | **Protected Profile**| `GET https://<render-url>/api/v1/auth/me` with Bearer token | `HTTP 200` with user profile |
| 4 | **Rate Limiting** | Fire 6 login attempts within 1 minute | `HTTP 429 Too Many Requests` on attempt 6 |
| 5 | **POS CSV ETL** | Upload dirty POS CSV to `/api/v1/etl/pos-upload` | `HTTP 200` with sanitized records |
| 6 | **ML Forecaster** | `GET https://<render-url>/api/v1/forecasting/demo` | `HTTP 200` with Ridge/RF demand projection |
| 7 | **Bajar ko Sathi** | `POST /api/v1/bajar-ko-sathi/chat` (Nepali query) | `HTTP 200` with grounded Nepali advice |
| 8 | **Inventory Alerts**| `GET /api/v1/inventory-alerts/demo` | `HTTP 200` with dead stock trapped capital in NPR |
| 9 | **WeasyPrint PDF** | `GET /api/v1/reports/weekly/demo-pdf` | `HTTP 200` downloading formatted A4 PDF |
| 10| **Frontend UI** | Open `https://<vercel-url>/dashboard` | Live Recharts, KPI cards, and Bajar ko Sathi widget |

---

## Phase 7: Production Troubleshooting & FAQ

### 1. CORS Error (`Access-Control-Allow-Origin`)
- **Symptom**: Browser console shows CORS preflight failure when frontend calls backend.
- **Fix**: Verify `BACKEND_CORS_ORIGINS` in Render includes your exact Vercel production domain (e.g. `["https://retailiq-nepal.vercel.app"]` without trailing slashes).

### 2. Database Connection Error (`asyncpg cannot connect`)
- **Symptom**: `asyncpg.exceptions.InvalidPasswordError` or SSL rejection.
- **Fix**: Render PostgreSQL requires SSL. Ensure your `DATABASE_URL` contains `?sslmode=require` or uses the internal Render database URL. The backend automatically handles protocol conversions.

### 3. Out of Memory (OOM) on Render Free Tier (<512MB RAM)
- **Symptom**: Service restarts with exit code 137.
- **Fix**: The backend is configured to run with `workers 1` in `Dockerfile`. Avoid spawning multiple Uvicorn worker processes on the 512MB free tier.

### 4. Gemini API Quota Exceeded
- **Symptom**: `429 RESOURCE_EXHAUSTED` from Google GenAI.
- **Fix**: 'Bajar ko Sathi' includes a deterministic rule-based fallback engine that continues serving grounded store answers even if external API limits are reached.
