#!/usr/bin/env bash
set -euo pipefail

# --- Configuration (override via environment or edit defaults below) ---
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-asia-south1}"

FRONTEND_SERVICE="${CLOUD_RUN_FRONTEND:-bulk-tester}"
WORKER_SERVICE="${CLOUD_RUN_WORKER:-bulk-tester-worker}"

FRONTEND_IMAGE="gcr.io/${PROJECT_ID}/${FRONTEND_SERVICE}"
WORKER_IMAGE="gcr.io/${PROJECT_ID}/${WORKER_SERVICE}"

# ─── 1. Build & deploy the WORKER service (Chrome + FFmpeg, one bot per instance) ───

echo "==> Building worker image: ${WORKER_IMAGE}"
gcloud builds submit --tag "${WORKER_IMAGE}" --project "${PROJECT_ID}" \
  --gcs-log-dir="gs://${PROJECT_ID}_cloudbuild/logs" \
  -f worker/Dockerfile .

echo "==> Deploying worker: ${WORKER_SERVICE}"
gcloud run deploy "${WORKER_SERVICE}" \
  --image "${WORKER_IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --memory "${CLOUD_RUN_WORKER_MEMORY:-4Gi}" \
  --cpu "${CLOUD_RUN_WORKER_CPU:-2}" \
  --concurrency 1 \
  --timeout "${CLOUD_RUN_WORKER_TIMEOUT:-600}" \
  --min-instances 0 \
  --max-instances "${CLOUD_RUN_WORKER_MAX:-20}" \
  --port 8080 \
  --no-allow-unauthenticated \
  --set-env-vars "NODE_ENV=production"

WORKER_URL=$(gcloud run services describe "${WORKER_SERVICE}" \
  --region "${REGION}" --project "${PROJECT_ID}" --format "value(status.url)")
echo "==> Worker deployed: ${WORKER_URL}"

# ─── 2. Build & deploy the FRONTEND service (Next.js only, no Chrome needed) ───

echo "==> Building frontend image: ${FRONTEND_IMAGE}"
gcloud builds submit --tag "${FRONTEND_IMAGE}" --project "${PROJECT_ID}"

echo "==> Deploying frontend: ${FRONTEND_SERVICE}"
gcloud run deploy "${FRONTEND_SERVICE}" \
  --image "${FRONTEND_IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --memory "${CLOUD_RUN_FRONTEND_MEMORY:-1Gi}" \
  --cpu 1 \
  --concurrency 80 \
  --timeout 60 \
  --min-instances 0 \
  --max-instances 3 \
  --port 8080 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,WORKER_URL=${WORKER_URL}"

FRONTEND_URL=$(gcloud run services describe "${FRONTEND_SERVICE}" \
  --region "${REGION}" --project "${PROJECT_ID}" --format "value(status.url)")

echo ""
echo "==> Deployment complete"
echo "    Frontend: ${FRONTEND_URL}"
echo "    Worker:   ${WORKER_URL}"
