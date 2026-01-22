# Use a slim base image
FROM node:22-bullseye-slim

# Install Chromium and required system dependencies
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

# Tell Puppeteer to use the installed Chromium and skip downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Copy package files first → better layer caching
COPY package*.json ./

# Install production dependencies only (use npm install since no package-lock.json)
RUN npm install --omit=dev --no-audit --no-fund

# Copy the rest of the application
COPY . .

# Expose the port your app will run on
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
