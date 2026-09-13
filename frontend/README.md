# RetailIQ Nepal - Frontend (Next.js + TypeScript + Tailwind CSS) ⚡

Production-grade Next.js App Router frontend designed for fast static edge delivery and zero-budget hosting on Vercel.

## 📁 Directory Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with fonts & metadata
│   │   ├── page.tsx           # Day 1 showcase dashboard with live inventory test
│   │   └── globals.css        # Tailwind directives & design tokens
│   ├── components/
│   │   └── HealthStatus.tsx   # Live backend probe badge (with cold-start state)
│   ├── lib/
│   │   └── api.ts             # API client with automatic retry mechanism
│   └── types/
│       └── index.ts           # Shared TypeScript interfaces
├── tailwind.config.ts         # Brand theme configuration
├── tsconfig.json              # TypeScript aliases (@/*)
├── next.config.mjs            # Production optimizations & rewrite proxy
├── package.json
└── .env.example
```

## 🛠️ Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env.local
   ```
   Default `NEXT_PUBLIC_API_URL` points to `http://localhost:8000`.

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## ☁️ Deploying on Vercel (Free Hobby Tier)

1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Select your GitHub repository.
4. Set **Root Directory** to `frontend`.
5. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL`: URL of your deployed Render backend (e.g. `https://retailiq-nepal-api.onrender.com`).
6. Click **Deploy**.
