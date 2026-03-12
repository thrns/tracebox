FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Install Playwright's Chromium + all required system dependencies
RUN npx playwright install --with-deps chromium

# Install FFmpeg (libvpx codec required for WebM screen recording)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY . .

ENV NODE_ENV=production

# Cloud Run injects PORT=8080; worker/index.ts reads process.env.PORT
EXPOSE 8080

CMD ["npx", "tsx", "worker/index.ts"]
