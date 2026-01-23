import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer'; // full puppeteer
import bodyParser from "body-parser";
import htmlDocx from 'html-docx-js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for images
app.use(bodyParser.json({ limit: "50mb" }));

// 👉 CHANGE THIS PATH IF EDGE IS INSTALLED ELSEWHERE
// const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// ================= PDF Generation (UNCHANGED) =================
app.post('/api/generate-pdf', async (req, res) => {
  const { html } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'HTML content is required' });
  }

  let browser;
  try {
browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]
});

    const page = await browser.newPage();

    await page.setViewport({
      width: 794,   // A4 width @ 96dpi
      height: 1122, // A4 height @ 96dpi
      deviceScaleFactor: 1
    });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 0
    });

    await page.emulateMediaType('screen');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });

    if (!pdfBuffer || !pdfBuffer.length) {
      throw new Error('Empty PDF buffer generated');
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="document.pdf"'
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    res.end(pdfBuffer);

  } catch (error) {
    console.error('PDF ERROR:', error);
    res.status(500).json({ error: 'PDF generation failed' });
  } finally {
    if (browser) await browser.close();
  }
});

// ================= IMPROVED DOCX Generation =================

// Prepare HTML with Word-compatible styling for better conversion
function prepareHtmlForDocx(html) {
  return `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="Microsoft Word 15">
  <meta name="Originator" content="Microsoft Word 15">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    /* Page setup for Word */
    @page WordSection1 {
      size: 595.3pt 841.9pt; /* A4 portrait */
      margin: 60px;
      mso-page-orientation: portrait;
    }
    
    div.WordSection1 { page: WordSection1; }
    
    /* Body styling */
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 15pt;
      color: #000000;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    
    /* Tables - preserve borders */
    table {
      border-collapse: collapse;
      width: 100%;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      mso-cellspacing: 0cm;
      mso-yfti-tbllook: 1184;
      mso-padding-alt: 0cm 5.4pt 0cm 5.4pt;
    }
    
    td, th {
      border: 1pt solid #000000;
      padding: 8pt;
      mso-border-alt: solid #000000 .5pt;
      vertical-align: top;
      mso-line-height-rule: exactly;
    }
    
    /* CRITICAL: Yellow highlighting */
    span[style*="background: #ffff00"],
    span[style*="background:#ffff00"],
    span[style*="background-color: #ffff00"],
    span[style*="background-color:#ffff00"],
    .highlight {
      background-color: #ffff00 !important;
      mso-highlight: yellow;
      background: yellow;
    }
    
    /* Red text */
    [style*="color: #b91c1c"],
    [style*="color:#b91c1c"] {
      color: #b91c1c;
      mso-font-color-alt: #b91c1c;
    }
    
    /* Red borders */
    [style*="border-top: 3px solid #b91c1c"],
    [style*="border-bottom: 3px solid #b91c1c"],
    [style*="border: 3px solid #b91c1c"] {
      border-color: #b91c1c !important;
      border-width: 3pt !important;
      border-style: solid !important;
      mso-border-alt: solid #b91c1c 3.0pt;
    }
    
    /* Black backgrounds */
    [style*="background: #000000"],
    [style*="background:#000000"],
    [style*="background-color: #000000"],
    div[style*="background: #000000"] {
      background-color: #000000 !important;
      color: #ffffff !important;
      mso-shading: solid;
      mso-pattern: solid #000000;
    }
    
    /* Gray backgrounds */
    [style*="background: #f3f4f6"],
    [style*="background:#f3f4f6"],
    td[style*="background: #f3f4f6"] {
      background-color: #f3f4f6 !important;
      mso-shading: solid;
      mso-pattern: solid #f3f4f6;
    }
    
    /* Blue text */
    [style*="color: #1e40af"],
    [style*="color:#1e40af"] {
      color: #1e40af;
    }
    
    /* Headings */
    h1, h2, h3 {
      font-weight: bold;
      page-break-after: avoid;
      mso-line-height-rule: exactly;
    }
    
    h1 { font-size: 24pt; }
    h2 { font-size: 20pt; }
    h3 { font-size: 18pt; }
    
    /* Paragraphs */
    p {
      margin: 0;
      padding: 10px 0;
      mso-line-height-rule: exactly;
    }
    
    /* Bold text */
    strong, b, [style*="font-weight: bold"] {
      font-weight: bold;
      mso-bidi-font-weight: bold;
    }
    
    /* Underline */
    u, [style*="text-decoration: underline"] {
      text-decoration: underline;
      mso-underline: single;
    }
    
    /* Page breaks */
    .page-break,
    div[style*="page-break-after: always"] {
      page-break-after: always;
      mso-special-character: line-break;
    }
    
    /* Images */
    img {
      max-width: 100%;
      height: auto;
      display: block;
      mso-wrap-style: square;
    }
    
    /* Italic */
    i, em, [style*="font-style: italic"] {
      font-style: italic;
      mso-bidi-font-style: italic;
    }
    
    /* Text alignment */
    [style*="text-align: center"] {
      text-align: center;
      mso-element: para-border-div;
    }
    
    [style*="text-align: right"] {
      text-align: right;
    }
    
    /* Letter spacing */
    [style*="letter-spacing"] {
      mso-ansi-language: EN-US;
    }
  </style>
</head>
<body>
<div class="WordSection1">
${html}
</div>
</body>
</html>`;
}

app.post("/api/generate-docx", async (req, res) => {
  try {
    const { html, filename } = req.body;

    if (!html) {
      return res.status(400).json({ error: "HTML content is required." });
    }

    // Prepare HTML with Word-compatible markup
    const preparedHtml = prepareHtmlForDocx(html);

    // Convert HTML to DOCX using html-docx-js
    const docxBlob = htmlDocx.asBlob(preparedHtml, {
      orientation: 'portrait',
      margins: {
        top: 1440,    // 1 inch in twips (1440 twips = 1 inch)
        right: 1440,
        bottom: 1440,
        left: 1440
      }
    });

    // Convert Blob to Buffer
    const docxBuffer = Buffer.from(await docxBlob.arrayBuffer());

    // Set headers for proper Word download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename || "document"}.docx"`
    );

    res.send(docxBuffer);

  } catch (error) {
    console.error("DOCX generation error:", error);
    res.status(500).json({ 
      error: "Failed to generate Word document.",
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: {
      pdf: '/api/generate-pdf',
      docx: '/api/generate-docx'
    }
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🚀 LandScale Server Running        ║
╠═══════════════════════════════════════╣
║   Port: ${PORT}                       ║
║   PDF:  /api/generate-pdf            ║
║   DOCX: /api/generate-docx           ║
╚═══════════════════════════════════════╝
  `);
});