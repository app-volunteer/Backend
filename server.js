import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));     // increased limit for large HTML

app.post('/api/generate-pdf', async (req, res) => {
  const { html, filename = 'document' } = req.body;

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Valid HTML string is required' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',                    // often helps in containers
        '--disable-software-rasterizer',
        '--single-process',                 // sometimes more stable in slim containers
      ],
      // You can increase if you get OOM → but usually not needed
      // handleSIGINT: false,
      // handleSIGTERM: false,
      // handleSIGHUP: false,
    });

    const page = await browser.newPage();

    // Optional: set viewport if you want more predictable layout
    // await page.setViewport({ width: 1920, height: 1080 });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 45000,
    });

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
    });

    // Set response headers
    res.contentType('application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/[^a-z0-9-_.]/gi, '_')}.pdf"`
    );

    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {}); // ignore close errors
    }
  }
});

// Health check endpoint (useful for Render/Railway)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PDF generation service running on port ${PORT}`);
});