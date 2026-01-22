import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import htmlToDocx from 'html-to-docx';

const app = express();
const PORT = process.env.PORT || 10000;

// CORS Configuration supporting multiple environments
const corsOptions = {
  origin: [
    'https://land-app-three.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    /\.vercel\.app$/, // Allow all Vercel preview deployments
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// Browser instance management for high-availability
let browserInstance = null;
let browserLaunchPromise = null;

async function getBrowser() {
  if (browserLaunchPromise) return browserLaunchPromise;
  if (browserInstance && browserInstance.isConnected()) return browserInstance;

  browserLaunchPromise = puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', // Let puppeteer decide if not specified
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process'
    ],
    timeout: 60000,
  });

  try {
    browserInstance = await browserLaunchPromise;
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

    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    
    // Set content and wait for it to be fully rendered
    await page.setContent(html, { 
      waitUntil: ["networkidle0", "load", "domcontentloaded"],
      timeout: 60000 
    });

    // Wait a bit for images and fonts to settle (Puppeteer 24 compatible)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      preferCSSPageSize: true
    });

    const duration = Date.now() - startTime;
    console.log(`[PDF] Generated successfully in ${duration}ms`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^a-z0-9-_.]/gi, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(`[PDF] Generation failed:`, error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
    }
  } finally {
    if (page) await page.close();
  }
});

app.post('/api/generate-docx', async (req, res) => {
  const { html, filename = 'document' } = req.body;

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Valid HTML string is required' });
  }

  try {
    console.log(`[DOCX] Starting generation for ${filename}`);
    
    // Using html-to-docx which is stable in Node environments
    const docxBuffer = await htmlToDocx(html, null, {
      margin: { top: 720, right: 720, bottom: 720, left: 720 },
      orientation: 'portrait'
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^a-z0-9-_.]/gi, '_')}.docx"`);
    res.send(docxBuffer);
  } catch (error) {
    console.error('[DOCX] Generation failed:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate DOCX', message: error.message });
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LandScale Render Node active on port ${PORT}`);
});