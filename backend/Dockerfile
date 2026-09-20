FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install runtime libraries for WeasyPrint PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libcairo2 \
    libgobject-2.0-0 \
    libpangoft2-1.0-0 \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app /app/app

EXPOSE 8000

# Run with 1 worker to stay well within 512MB RAM on Render free tier
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
