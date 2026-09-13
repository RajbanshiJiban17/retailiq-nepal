# RetailIQ Nepal 🇳🇵

An intelligent, full-stack retail operating system and inventory analytics platform built specifically for Nepalese storekeepers and supermarkets.

Engineered with a high-performance **FastAPI (Python 3.12)** backend, **PostgreSQL (SQLAlchemy 2.0)**, **Next.js 14 (TypeScript + Tailwind CSS + Recharts)** frontend, and **Google Gemini 3.6 Flash (RAG in Nepali)**, optimized for a **100% zero-budget deployment** on **Render** and **Vercel**.

---

## 🌟 Full Feature Matrix

1. **Multi-Tenant Architecture**: Strict `business_id` scoping across all models (Users, Products, Sales, Sale Items, Reports) with composite unique constraints and zero cross-tenant leakage.
2. **POS CSV ETL Pipeline**: Automatic normalization of dirty point-of-sale exports, stripping currency noise (`Rs.`, `NPR`, commas), generating automatic SKUs, and executing atomic batch insertions.
3. **Scikit-Learn Demand Forecasting**: Continuous chronological resampling, Ridge & Random Forest regressors, predicting SKU depletion velocities, safety stock buffers, and reorder alerts.
4. **'Bajar ko Sathi' (बजारको साथी) AI Assistant**: Grounded Nepali business advisor powered by the Gemini 3.6 Flash API and RAG, answering store performance queries strictly from database facts with zero hallucination.
5. **Responsive Analytics Dashboard**: Next.js 14 App Router, Tailwind CSS, and Recharts visualizing Gross Profit, Monthly Sales Trends (highlighting Saturday peaks), Top-Selling SKUs, and Nepali Payment Channel distribution (Fonepay 42%, Cash 32%, eSewa 18%, Cards 5%, Udharo 3%).
6. **Dead Stock Detection & Low-Stock Alert Engine**: Identifies items unsold for months, computes trapped working capital in NPR, flags out-of-stock emergencies, and generates clearance advice in Nepali.
7. **WeasyPrint Weekly Business Performance PDF Reports**: Background task service compiling A4 executive PDF reports with financial scorecards, top movers, risk summaries, and AI recommendations.
8. **JWT Authentication & SlowAPI Rate Limiting**: Salted bcrypt password hashing, multi-tenant signed JWT tokens, role-based access control (Admin, Manager, Cashier), and rate limiting shields against brute-force attacks.

---

## 📁 Repository Structure

```
retailiq-nepal/
├── backend/                  # FastAPI Python Backend
│   ├── app/
│   │   ├── api/v1/          # Versioned API routes (auth, items, etl, forecasting, bajar_sathi, inventory_alerts, reports)
│   │   ├── core/            # Config, database, security (JWT, bcrypt), limiter (SlowAPI)
│   │   ├── models/          # Multi-tenant SQLAlchemy 2.0 models (Business, User, Product, Sale, SaleItem)
│   │   ├── schemas/         # Pydantic v2 validation models
│   │   ├── services/        # ML forecaster, Bajar Sathi RAG, inventory alerts, PDF generator
│   │   ├── templates/       # Jinja2 A4 print-ready HTML report templates
│   │   └── main.py          # App lifespan, CORS, limiter middleware
│   ├── render.yaml          # Render Blueprint for Docker web service + Managed PostgreSQL
│   ├── Dockerfile           # Production container with Linux GTK packages (Pango/Cairo for WeasyPrint)
│   ├── .dockerignore        # Lean Docker context exclusion
│   ├── .env.production.example # Production environment template
│   └── requirements.txt     # Python dependencies
│
├── frontend/                 # Next.js 14+ App Router Frontend
│   ├── src/
│   │   ├── app/             # App router pages (/dashboard, /, layout.tsx)
│   │   ├── components/      # UI, Recharts analytics, KPI cards, Bajar ko Sathi widget
│   │   ├── lib/             # API client with cold-start keepalive retry logic
│   │   └── types/           # Shared TypeScript interfaces
│   ├── vercel.json          # Vercel deployment configuration & security headers
│   ├── .vercelignore        # Vercel upload exclusions
│   ├── .env.production.example # Frontend production environment template
│   ├── tailwind.config.ts   # Design tokens & color system
│   └── package.json         # Node dependencies (Recharts, Lucide, Tailwind)
│
├── docs/
│   └── DEPLOYMENT_GUIDE.md  # Complete 7-Phase step-by-step production deployment guide
├── render.yaml              # Root Render Infrastructure as Code blueprint
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### 1. Backend Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1   # On macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```
- **API Docs (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 2. Frontend Setup

```powershell
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
- **Live Landing Page**: [http://localhost:3000](http://localhost:3000)
- **Retail Analytics Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

---

## ☁️ Production Deployment (Zero-Budget on Render & Vercel)

For complete, battle-tested step-by-step instructions, refer to the **[Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md)**.

### Deployment Summary:
1. **Render Database & Backend**: Deploy using root [`render.yaml`](render.yaml) as a Blueprint or connect the GitHub repo directly.
   - Database: Free Managed PostgreSQL (Singapore region).
   - Backend: Docker Web Service (512MB RAM, WeasyPrint GTK system packages enabled).
2. **Vercel Frontend**: Connect GitHub repo, set Root Directory to `frontend`, add `NEXT_PUBLIC_API_URL=https://<your-render-url>`, and click **Deploy**.
3. **Cold-Start Elimination**: Setup free 14-minute keepalive ping via UptimeRobot to `/api/v1/health`.
