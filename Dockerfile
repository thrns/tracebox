FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    wget \
    ffmpeg \
    # Required for SwiftShader software WebGL in headless Chrome on Cloud Run (no GPU)
    libgles2 \
    libegl1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Install Playwright's managed Chromium with all system dependencies
RUN npx playwright install --with-deps chromium

COPY . .

# Build-time args for NEXT_PUBLIC_* vars (must be inlined by Next.js at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

ENV NODE_ENV=production
# Worker runs on fixed internal port 3001; Next.js uses Cloud Run's injected PORT (default 8080)
ENV WORKER_PORT=3001

EXPOSE 8080

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/bin/bash", "/app/start.sh"]
