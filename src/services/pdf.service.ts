import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateReportHtml } from '../utils/reportTemplate';
import { uploadJobAttachment } from './housecallpro.service';
import type { Inspection, InspectionItem, Company, ApiResponse } from '../types';

interface CategoryGroup {
  category: string;
  items: InspectionItem[];
}

export interface PDFGenerationResult {
  uri: string;
  fileName: string;
  blob?: Blob; // For web uploads
}

/**
 * Generates a PDF blob from HTML on web using html2pdf.js
 */
async function generatePDFBlobWeb(html: string): Promise<Blob> {
  // Dynamically import html2pdf.js only on web
  const html2pdf = (await import('html2pdf.js')).default;

  // Create a container element
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.width = '800px'; // Fixed width for consistent rendering
  document.body.appendChild(container);

  try {
    console.log('Generating PDF from HTML...');
    const pdfBlob = await html2pdf()
      .set({
        margin: 10,
        filename: 'report.pdf',
        image: { type: 'jpeg', quality: 0.8 }, // Slightly lower quality to reduce size
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true, // Allow cross-origin images even if they taint canvas
          logging: false,
          imageTimeout: 15000, // 15 second timeout for image loading
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container)
      .outputPdf('blob');

    console.log('PDF generated successfully, size:', pdfBlob.size, 'bytes');
    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generates a PDF inspection report from the inspection data
 */
export async function generateInspectionPDF(
  inspection: Inspection,
  categories: CategoryGroup[],
  company: Company | null
): Promise<ApiResponse<PDFGenerationResult>> {
  try {
    const html = generateReportHtml(inspection, categories, company);
    const fileName = `Inspection_${inspection.project_name.replace(/[^a-zA-Z0-9]/g, '_')}_${
      new Date().toISOString().split('T')[0]
    }.pdf`;

    if (Platform.OS === 'web') {
      // Generate actual PDF blob on web
      const blob = await generatePDFBlobWeb(html);
      const uri = URL.createObjectURL(blob);

      return {
        data: { uri, fileName, blob },
        error: null,
      };
    }

    // Native platforms
    const result = await Print.printToFileAsync({
      html,
      base64: false,
    });

    return {
      data: { uri: result.uri, fileName },
      error: null,
    };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return {
      data: null,
      error: (error as Error).message,
    };
  }
}

/**
 * Generates a PDF and uploads it to Housecall Pro as a job attachment
 */
export async function generateAndUploadReport(
  companyId: string,
  jobId: string,
  inspection: Inspection,
  categories: CategoryGroup[],
  company: Company | null
): Promise<ApiResponse<{ pdfUri: string; attachmentId: string }>> {
  try {
    // Step 1: Generate PDF
    console.log('Step 1: Generating PDF...');
    const pdfResult = await generateInspectionPDF(inspection, categories, company);

    if (pdfResult.error || !pdfResult.data) {
      console.error('PDF generation failed:', pdfResult.error);
      return {
        data: null,
        error: `PDF generation failed: ${pdfResult.error || 'Unknown error'}`,
      };
    }

    const { uri, fileName, blob } = pdfResult.data;
    console.log('PDF generated:', fileName, 'blob size:', blob?.size || 'N/A');

    // Step 2: Upload to HCP
    console.log('Step 2: Uploading to HCP job:', jobId);
    const uploadResult = await uploadJobAttachment(
      companyId,
      jobId,
      uri,
      fileName,
      'application/pdf'
    );

    if (uploadResult.error || !uploadResult.data) {
      console.error('HCP upload failed:', uploadResult.error);
      return {
        data: null,
        error: `HCP upload failed: ${uploadResult.error || 'Unknown error'}`,
      };
    }

    console.log('Upload successful, attachment ID:', uploadResult.data.id);
    return {
      data: {
        pdfUri: uri,
        attachmentId: uploadResult.data.id,
      },
      error: null,
    };
  } catch (error) {
    console.error('generateAndUploadReport error:', error);
    return {
      data: null,
      error: `Unexpected error: ${(error as Error).message}`,
    };
  }
}

/**
 * Opens the PDF for local preview/sharing
 */
export async function previewPDF(uri: string, blob?: Blob, fileName?: string): Promise<ApiResponse<null>> {
  try {
    if (Platform.OS === 'web') {
      // Download the PDF file on web
      const link = document.createElement('a');
      link.href = uri;
      link.download = fileName || 'Inspection_Report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return { data: null, error: null };
    }

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { data: null, error: 'Sharing is not available on this device' };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Inspection Report',
      UTI: 'com.adobe.pdf',
    });

    return { data: null, error: null };
  } catch (error) {
    console.error('Error previewing PDF:', error);
    return {
      data: null,
      error: (error as Error).message,
    };
  }
}
