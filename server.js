import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { htmlToDocx } from 'html-docx-js';

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Browser instance management
let browserInstance = null;
let browserLaunchPromise = null;

async function getBrowser() {
  // If browser is already launching, wait for it
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  // If browser exists and is connected, return it
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Launch new browser
  browserLaunchPromise = puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
    ],
    ignoreHTTPSErrors: true,
    timeout: 60000,
  });

  try {
    browserInstance = await browserLaunchPromise;
    
    // Handle browser disconnect
    browserInstance.on('disconnected', () => {
      console.log('Browser disconnected, will relaunch on next request');
      browserInstance = null;
    });

    return browserInstance;
  } catch (error) {
    browserInstance = null;
    throw error;
  } finally {
    browserLaunchPromise = null;
  }
}

app.post('/api/generate-pdf', async (req, res) => {
  const { html, filename = 'document' } = req.body;

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Valid HTML string is required' });
  }

  let page = null;
  const startTime = Date.now();

  try {
    console.log(`[PDF] Starting generation for ${filename}`);
    
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({ 
      width: 1920, 
      height: 1080,
      deviceScaleFactor: 2 
    });

    // Set shorter timeout for content loading
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    console.log('[PDF] Content loaded, generating PDF...');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      landscape: false,
      scale: 1,
      preferCSSPageSize: false,
    });

    const duration = Date.now() - startTime;
    console.log(`[PDF] Generated successfully in ${duration}ms`);

    // Set response headers
    res.contentType('application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/[^a-z0-9-_.]/gi, '_')}.pdf"`
    );

    res.send(pdfBuffer);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[PDF] Generation failed after ${duration}ms:`, error.message);
    
    // If browser connection failed, reset it
    if (error.message.includes('Target closed') || error.message.includes('Protocol error')) {
      browserInstance = null;
    }

    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message,
      hint: 'Server may be under heavy load. Please try again.',
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (err) {
        console.error('[PDF] Error closing page:', err.message);
      }
    }
  }
});

app.post('/api/generate-docx', async (req, res) => {
  const { html, filename = 'document' } = req.body;

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Valid HTML string is required' });
  }

  try {
    console.log(`[DOCX] Starting generation for ${filename}`);
    
    const docxBuffer = htmlToDocx(html, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    console.log('[DOCX] Generated successfully');

    res.contentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/[^a-z0-9-_.]/gi, '_')}.docx"`
    );

    res.send(Buffer.from(docxBuffer));
  } catch (error) {
    console.error('[DOCX] Generation failed:', error.message);
    res.status(500).json({
      error: 'Failed to generate Word document',
      message: error.message,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const isConnected = browserInstance && browserInstance.isConnected();
  res.json({ 
    status: 'ok',
    browser: isConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing browser...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PDF generation service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});