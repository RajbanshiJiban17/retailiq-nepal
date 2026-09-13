# RetailIQ Nepal - Backend API 🚀

FastAPI backend designed for low latency, memory efficiency (<512MB RAM), and instant deployment on Render's free tier.

## 📁 Directory Structure
```
backend/
├── app/
│   ├── api/v1/
│   │   ├── endpoints/
│   │   │   ├── health.py        # Keepalive & monitoring probe
│   │   │   └── items.py         # Inventory CRUD example
│   │   └── router.py            # Route aggregator
│   ├── core/
│   │   └── config.py            # Environment variables & CORS
│   ├── models/                  # Database models
│   ├── schemas/                 # Pydantic request/response schemas
│   │   └── health.py
│   └── main.py                  # App entry point
├── render.yaml                  # Render deployment blueprint
├── Dockerfile                   # Multi-stage lightweight container
├── requirements.txt
└── .env.example
```

## 🛠️ Local Development Setup

1. **Activate Virtual Environment**:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\Activate.ps1
   # Linux/macOS:
   source .venv/bin/activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```

4. **Start Development Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

- Interactive OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Render Keepalive Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

## ☁️ Deploying on Render (Free Tier)

### Method A: Blueprint (Recommended)
1. Push your code to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint**.
3. Select your repository. Render reads `backend/render.yaml` automatically.

### Method B: Manual Web Service
- **Environment**: Python 3
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/api/v1/health`
- **Plan**: Free
