FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# HF Spaces persistent storage (if enabled) is mounted at /data;
# fall back to a writable in-image dir otherwise.
ENV CACHE_DIR=/tmp/cache
ENV PORT=7860

EXPOSE 7860

CMD ["python", "server.py"]
