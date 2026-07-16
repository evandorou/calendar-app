# --- Notebook Calendar API ---------------------------------------------
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user
RUN useradd --create-home appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data
USER appuser

# Default DB lives on a mountable volume so data survives container restarts
ENV DATABASE_URL=sqlite:////data/calendar.db
VOLUME ["/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://localhost:' + os.environ.get('PORT','8000') + '/')" || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
