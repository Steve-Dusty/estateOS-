import PDFDocument from 'pdfkit';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const BRAND    = '#06B6D4';
const DARK     = '#E2E8F0';
const MUTED    = '#94A3B8';
const LIGHT_BG = '#151B28';

const LEFT_MARGIN   = 54;
const TOP_MARGIN    = 72;
const CONTENT_WIDTH = 504;

function getOutputDir(): string {
  return process.env.GENERATED_ASSETS_DIR ?? join(process.cwd(), 'public', 'generated');
}

export interface ReportData {
  title: string;
  subtitle: string;
  executive_summary: string;
  property_details: string[][];
  sections: { heading: string; body: string }[];
  key_metrics: string[][];
  conclusion: string;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  rows: string[][],
  colWidths: number[],
  startY: number,
): number {
  const ROW_HEIGHT  = 22;
  const totalWidth  = colWidths.reduce((a, b) => a + b, 0);
  let y = startY;

  for (let i = 0; i < rows.length; i++) {
    if (y + ROW_HEIGHT > 720) {
      doc.addPage();
      y = TOP_MARGIN;
    }

    if (i === 0) {
      doc.rect(LEFT_MARGIN, y, totalWidth, ROW_HEIGHT).fill(BRAND);
    } else {
      doc.rect(LEFT_MARGIN, y, totalWidth, ROW_HEIGHT).fill(i % 2 === 0 ? '#f3f4f6' : 'white');
    }

    let x = LEFT_MARGIN;
    for (let j = 0; j < rows[i].length && j < colWidths.length; j++) {
      const textColor = i === 0 ? 'white' : '#111827';
      const bold      = i === 0 || j === 0;
      doc
        .fillColor(textColor)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .text(String(rows[i][j] ?? ''), x + 6, y + 6, {
          width:      colWidths[j] - 12,
          lineBreak:  false,
          ellipsis:   true,
        });
      x += colWidths[j];
    }

    doc
      .rect(LEFT_MARGIN, y, totalWidth, ROW_HEIGHT)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke();

    y += ROW_HEIGHT;
  }

  return y;
}

export function buildPdf(data: ReportData): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:    'letter',
      margins: { top: TOP_MARGIN, bottom: 54, left: LEFT_MARGIN, right: 54 },
    });

    const buffers: Buffer[] = [];
    doc.on('data',  (chunk: Buffer) => buffers.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      const filename  = `report_${randomBytes(4).toString('hex')}.pdf`;
      const dir       = getOutputDir();
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, filename), pdfBuffer);
      resolve(filename);
    });

    doc.rect(LEFT_MARGIN, TOP_MARGIN, CONTENT_WIDTH, 54).fill(BRAND);
    doc
      .fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(data.title ?? 'Property Report', LEFT_MARGIN + 16, TOP_MARGIN + 16, {
        width:     CONTENT_WIDTH - 32,
        lineBreak: false,
        ellipsis:  true,
      });
    doc.text('', LEFT_MARGIN, TOP_MARGIN + 68);

    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(11)
      .text(data.subtitle ?? 'Prepared by EstateOS', {
        align: 'center',
        width: CONTENT_WIDTH,
      });
    doc.moveDown(0.3);

    doc.rect(LEFT_MARGIN, doc.y, CONTENT_WIDTH, 1).fill('#e5e7eb');
    doc.text('', LEFT_MARGIN, doc.y + 10);

    if (data.executive_summary) {
      doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(13).text('Executive Summary');
      doc.moveDown(0.3);

      const sumText  = data.executive_summary;
      const sumY     = doc.y;
      const sumTextH = doc.heightOfString(sumText, { width: CONTENT_WIDTH - 20, lineGap: 3 });
      const BOX_H    = sumTextH + 16;

      doc.rect(LEFT_MARGIN, sumY, CONTENT_WIDTH, BOX_H).fill('#f3f4f6');
      doc
        .fillColor('#111827')
        .font('Helvetica')
        .fontSize(10)
        .text(sumText, LEFT_MARGIN + 10, sumY + 8, { width: CONTENT_WIDTH - 20, lineGap: 3 });

      doc.text('', LEFT_MARGIN, sumY + BOX_H + 10);
    }

    if (data.property_details?.length) {
      doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(13).text('Property Details');
      doc.moveDown(0.3);

      const afterTable = drawTable(
        doc,
        data.property_details,
        [180, CONTENT_WIDTH - 180],
        doc.y,
      );
      doc.text('', LEFT_MARGIN, afterTable + 12);
    }

    for (const section of data.sections ?? []) {
      if (doc.y > 650) {
        doc.addPage();
        doc.text('', LEFT_MARGIN, TOP_MARGIN);
      }

      doc
        .fillColor(BRAND)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(section.heading ?? '');
      doc.moveDown(0.3);

      doc
        .fillColor('#111827')
        .font('Helvetica')
        .fontSize(10)
        .text(section.body ?? '', { lineGap: 3 });
      doc.moveDown(0.8);
    }

    if (data.key_metrics?.length) {
      if (doc.y > 600) {
        doc.addPage();
        doc.text('', LEFT_MARGIN, TOP_MARGIN);
      }

      doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(13).text('Key Metrics');
      doc.moveDown(0.3);

      const colCount    = data.key_metrics[0]?.length ?? 3;
      const colWidth    = CONTENT_WIDTH / colCount;
      const afterMetrics = drawTable(
        doc,
        data.key_metrics,
        Array<number>(colCount).fill(colWidth),
        doc.y,
      );
      doc.text('', LEFT_MARGIN, afterMetrics + 12);
    }

    if (data.conclusion) {
      if (doc.y > 650) {
        doc.addPage();
        doc.text('', LEFT_MARGIN, TOP_MARGIN);
      }

      doc
        .fillColor(BRAND)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('Conclusion & Recommendations');
      doc.moveDown(0.3);

      doc
        .fillColor('#111827')
        .font('Helvetica')
        .fontSize(10)
        .text(data.conclusion, { lineGap: 3 });
      doc.moveDown(1);
    }

    doc.rect(LEFT_MARGIN, doc.y, CONTENT_WIDTH, 1).fill(MUTED);
    doc.moveDown(0.3);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(
        'Generated by EstateOS · For informational purposes only',
        { align: 'center', width: CONTENT_WIDTH },
      );

    doc.end();
  });
}
