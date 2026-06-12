FROM python:3.10-slim

WORKDIR /app

# Install build dependencies for compiling Python packages (insightface requires compiler for Cython modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the buffalo_l model during docker build
# This downloads model archives to /root/.insightface/models/buffalo_l/ and decompresses them.
# It ensures the service can start up offline instantly without downloading on container spin-up.
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l')"

# Copy application source
COPY . .

# Expose microservice port
EXPOSE 5006

# Run FastAPI app with gunicorn and uvicorn workers
CMD ["gunicorn", "main:app", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:5006", "--timeout", "120"]
