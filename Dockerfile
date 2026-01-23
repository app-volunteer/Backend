# Use Node.js 22 slim image (stable + small)
FROM node:22-bullseye-slim

# Install Chromium and all required Puppeteer dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    libxshmfence1 \
    libwayland-client0 \
    libwayland-egl1 \
    libxkbcommon0 \
    libegl1 \
    libgles2 \
    libepoxy0 \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer environment config (MATCHES YOUR server.js)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# App directory
WORKDIR /app

# Copy dependency files first (better cache)
COPY package*.json ./

# Install dependencies (html-docx-js + puppeteer must be normal deps)
RUN npm install --omit=dev --no-audit --no-fund

# Copy application source
COPY . .

# Expose server port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
