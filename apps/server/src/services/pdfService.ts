import { PDFDocument, rgb } from 'pdf-lib';

export class PdfService {
  /**
   * Embeds fields (text and signatures) into a PDF.
   * 
   * @param pdfUrl URL of the PDF to modify (or base64 string if testing)
   * @param fields list of fields with coordinates and values
   * @param scale scale factor used in the frontend (defaults to 1.3 as seen in DocumentSigner)
   * @returns Buffer of the flattened PDF
   */
  static async compilePdf(pdfUrl: string, fields: any[], scale = 1.3): Promise<Buffer> {
    let pdfBuffer: Buffer | ArrayBuffer;

    try {
      if (pdfUrl.startsWith('http')) {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        pdfBuffer = await response.arrayBuffer();
      } else if (pdfUrl.startsWith('data:application/pdf;base64,')) {
        pdfBuffer = Buffer.from(pdfUrl.split(',')[1], 'base64');
      } else if (pdfUrl === 'mock-pdf-url') {
        const doc = await PDFDocument.create();
        doc.addPage([600, 400]);
        return Buffer.from(await doc.save());
      } else if (pdfUrl.includes('/') || pdfUrl.length > 0) {
        // Assume relative storage path (e.g., /uploads/xxx.pdf)
        const { getSignedUrl } = require('./bytescale');
        const signedUrl = getSignedUrl(pdfUrl);
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`Failed to fetch PDF from storage: ${response.statusText}`);
        pdfBuffer = await response.arrayBuffer();
      } else {
        throw new Error('Unsupported PDF source format');
      }

      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      for (const field of fields) {
        if (!field.page || field.page > pages.length) continue;

        const page = pages[field.page - 1];
        const { width, height } = page.getSize();

        // Coordinate conversion
        // Frontend sends X,Y relative to a scaled canvas. 
        // We need to convert back to PDF points (unscaled).
        // PDF origin is bottom-left (usually), Frontend (Canvas) is top-left.
        // x_pdf = x_front / scale
        // y_pdf = height - (y_front / scale) - (field_height / scale)

        // NOTE: DocumentSigner adds fields to 'absolute' div on top of canvas.
        // We need to verify if the frontend coords include the header/margin offset.
        // Assuming the 'x' and 'y' are relative to the PDF Page Container.

        const x = field.x / scale;
        // Flip Y axis
        const fieldH = field.height / scale; // height on PDF
        const y = height - (field.y / scale) - fieldH;

        if (field.type === 'signature' && field.signatureData) {
          try {
            const pngImage = await pdfDoc.embedPng(field.signatureData);
            page.drawImage(pngImage, {
              x,
              y,
              width: field.width / scale,
              height: fieldH,
            });
          } catch (e) {
            console.error('Failed to embed signature:', e);
          }
        } else if ((field.type === 'input' || field.type === 'variable') && field.value) {
          // Draw Text
          // Font handling might be needed, using standard font for now
          // const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          page.drawText(field.value, {
            x: x + 2, // Slight padding
            y: y + (fieldH / 2), // vertically centered-ish
            size: 10,
            color: rgb(0, 0, 0),
          });
        }
      }

      const savedPdf = await pdfDoc.save();
      return Buffer.from(savedPdf);

    } catch (error) {
      console.error('PdfService.compilePdf error:', error);
      throw error;
    }
  }
}
