FROM python:3.11-slim

# Fix for heavy ML libs — install essential system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libopenblas-dev \
    liblapack-dev \
    libblas-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements separately for caching
COPY requirements.txt .

# 🟢 Install PyTorch (CPU only) BEFORE other packages
# This avoids version mismatches and prevents faiss/scipy build failures
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# 🟢 NOW install everything else
RUN pip install --no-cache-dir -r requirements.txt

# Copy full backend code
COPY . .

EXPOSE 8001

# Run FastAPI with Gunicorn + Uvicorn workers
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8001", "--workers", "2", "--timeout", "180"]
