/**
 * Export any HTML element (or the entire page content) as a PDF file.
 * Uses html2canvas to capture the rendered DOM and jsPDF to embed it.
 *
 * Usage:
 *   await exportElementToPdf(document.getElementById('my-section')!, 'report.pdf')
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfOptions {
  filename?: string;
  /** Page size. Defaults to A4. */
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  /** Scale factor for html2canvas (2 = 2× resolution). Defaults to 2. */
  scale?: number;
}

/**
 * Captures an HTML element and saves it as a PDF file.
 * Returns a data URL of the generated PDF.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfOptions = {},
): Promise<void> {
  const {
    filename    = 'documento.pdf',
    format      = 'a4',
    orientation = 'portrait',
    scale       = 2,
  } = options;

  // Snapshot the element at 2× resolution for crisp rendering
  const canvas = await html2canvas(element, {
    scale,
    useCORS:     true,
    logging:     false,
    backgroundColor: '#0a0a0a',
  });

  const imgWidth  = canvas.width  / scale;
  const imgHeight = canvas.height / scale;

  // A4 = 210 × 297 mm | letter = 216 × 279 mm
  const pageDims = format === 'letter' ? { w: 216, h: 279 } : { w: 210, h: 297 };

  const pdf = new jsPDF({
    orientation,
    unit:   'mm',
    format,
  });

  // Fit the capture width to the page, split into multiple pages if needed
  const pdfWidth  = orientation === 'portrait' ? pageDims.w : pageDims.h;
  const ratio     = pdfWidth / imgWidth;
  const pdfHeight = imgHeight * ratio;

  let posY    = 0;
  const pageH = orientation === 'portrait' ? pageDims.h : pageDims.w;

  while (posY < pdfHeight) {
    if (posY > 0) pdf.addPage();
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.95),
      'JPEG',
      0, -posY, pdfWidth, pdfHeight,
    );
    posY += pageH;
  }

  pdf.save(filename);
}

/**
 * Convenience wrapper: generates a PDF from the print-content of a print window.
 * Lighter alternative — uses the same HTML we already generate for print.
 */
export function exportHtmlToPdf(html: string, filename = 'documento.pdf'): void {
  // Create an off-screen iframe, render the HTML, capture with html2canvas
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1px;border:none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for fonts/images to load
  setTimeout(async () => {
    try {
      await exportElementToPdf(doc.body, { filename, scale: 2 });
    } finally {
      document.body.removeChild(iframe);
    }
  }, 800);
}
