import type { Inspection, InspectionItem, MeasurementValue, Company, ItemValue, SelectionOption } from '../types';

interface CategoryGroup {
  category: string;
  items: InspectionItem[];
}

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  satisfactory: { label: 'Satisfactory', color: '#15803d', bgColor: '#dcfce7' },
  recommended: { label: 'Recommended', color: '#ca8a04', bgColor: '#fef9c3' },
  unsafe: { label: 'Unsafe', color: '#dc2626', bgColor: '#fee2e2' },
  na: { label: 'N/A', color: '#2563eb', bgColor: '#dbeafe' },
  pending: { label: 'Pending', color: '#6b7280', bgColor: '#f3f4f6' },
};

function formatMeasurement(value: MeasurementValue | null): string {
  if (!value) return '-';
  const parts: string[] = [];
  if (value.feet) parts.push(`${value.feet}'`);
  if (value.inches) parts.push(`${value.inches}"`);
  return parts.length > 0 ? parts.join(' ') : '-';
}

function formatItemValue(item: InspectionItem): string {
  const value = item.value;

  switch (item.item_type) {
    case 'measurement':
      return formatMeasurement(value as MeasurementValue | null);
    case 'number':
      return value != null ? String(value) : '-';
    case 'yesno':
      if (value === true) return 'Yes';
      if (value === false) return 'No';
      return '-';
    case 'passfail':
      if (value === 'pass') return 'Pass';
      if (value === 'fail') return 'Fail';
      return '-';
    case 'text':
      return typeof value === 'string' && value ? value : '-';
    case 'selection':
      if (typeof value === 'string' && item.options) {
        const option = item.options.find((opt: SelectionOption) => opt.value === value);
        return option ? option.label : value;
      }
      return '-';
    default:
      return '-';
  }
}

function getValueBadgeHtml(item: InspectionItem): string {
  const formattedValue = formatItemValue(item);

  // For yes/no, use colored badges
  if (item.item_type === 'yesno') {
    if (item.value === true) {
      return `<span style="
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        background-color: #dcfce7;
        color: #15803d;
      ">Yes</span>`;
    }
    if (item.value === false) {
      return `<span style="
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        background-color: #fee2e2;
        color: #dc2626;
      ">No</span>`;
    }
  }

  // For pass/fail, use colored badges
  if (item.item_type === 'passfail') {
    if (item.value === 'pass') {
      return `<span style="
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        background-color: #dcfce7;
        color: #15803d;
      ">Pass</span>`;
    }
    if (item.value === 'fail') {
      return `<span style="
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        background-color: #fee2e2;
        color: #dc2626;
      ">Fail</span>`;
    }
  }

  // For selection, use a blue badge
  if (item.item_type === 'selection' && item.value) {
    return `<span style="
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background-color: #dbeafe;
      color: #2563eb;
    ">${formattedValue}</span>`;
  }

  // Default: just show the value
  return `<span style="font-size: 14px; font-weight: 600; color: #1E3A5F;">${formattedValue}</span>`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getNextYearDate(): string {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return nextYear.toISOString();
}

function getStatusBadgeHtml(status: string): string {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return `<span style="
    display: inline-block;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    background-color: ${config.bgColor};
    color: ${config.color};
  ">${config.label}</span>`;
}

export function generateReportHtml(
  inspection: Inspection,
  categories: CategoryGroup[],
  company: Company | null
): string {
  // Check if this is a Chimney Inspection (by category names containing "Chimney")
  const isChimneyInspection = categories.some(cat =>
    cat.category.toLowerCase().includes('chimney')
  );

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const categoryHtml = categories.map(cat => {
    const itemsHtml = cat.items.map((item, index) => {
      const isLast = index === cat.items.length - 1;
      const borderStyle = isLast ? '' : 'border-bottom: 1px solid #f3f4f6;';

      // Generate photos HTML for this item
      const itemPhotosHtml = item.photos && item.photos.length > 0
        ? `<div style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
            padding-top: 8px;
          ">
            ${item.photos.map(photo => `
              <img src="${photo.photo_url}" alt="${photo.caption || item.name}" style="
                width: 80px;
                height: 80px;
                object-fit: cover;
                border-radius: 4px;
                border: 1px solid #e5e7eb;
              " />
            `).join('')}
          </div>`
        : '';

      // Generate notes HTML for this item
      const itemNotesHtml = item.notes
        ? `<div style="
            margin-top: 8px;
            padding: 8px 12px;
            background-color: #f0fdf4;
            border-left: 3px solid #22c55e;
            border-radius: 4px;
            font-size: 12px;
            color: #374151;
            page-break-inside: avoid;
            break-inside: avoid;
          ">
            <strong style="color: #15803d;">Note:</strong> ${item.notes}
          </div>`
        : '';

      // Handle different item types
      if (item.item_type === 'status') {
        // Status type - show status badge
        return `
          <div class="no-break" style="
            padding: 12px 16px;
            ${borderStyle}
            page-break-inside: avoid;
            break-inside: avoid;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1;">
                <div style="font-size: 14px; color: #374151;">${item.name}</div>
                ${item.description ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${item.description}</div>` : ''}
              </div>
              ${getStatusBadgeHtml(item.status)}
            </div>
            ${itemNotesHtml}
            ${itemPhotosHtml}
          </div>
        `;
      }

      if (item.item_type === 'text') {
        // Text type - show the text value below the name
        const textValue = typeof item.value === 'string' && item.value ? item.value : '-';
        return `
          <div class="no-break" style="
            padding: 12px 16px;
            ${borderStyle}
            page-break-inside: avoid;
            break-inside: avoid;
          ">
            <div style="font-size: 14px; color: #374151; font-weight: 500;">${item.name}</div>
            ${item.description ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${item.description}</div>` : ''}
            <div style="
              margin-top: 8px;
              padding: 8px 12px;
              background-color: #f9fafb;
              border-radius: 4px;
              font-size: 14px;
              color: #374151;
              white-space: pre-wrap;
            ">${textValue}</div>
            ${itemNotesHtml}
            ${itemPhotosHtml}
          </div>
        `;
      }

      // For measurement, number, yesno, selection - show value on the right
      return `
        <div class="no-break" style="
          padding: 12px 16px;
          ${borderStyle}
          page-break-inside: avoid;
          break-inside: avoid;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div style="font-size: 14px; color: #374151;">${item.name}</div>
              ${item.description ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${item.description}</div>` : ''}
            </div>
            ${getValueBadgeHtml(item)}
          </div>
          ${itemNotesHtml}
          ${itemPhotosHtml}
        </div>
      `;
    }).join('');

    return `
      <div style="
        margin-bottom: 24px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      ">
        <div style="
          background: #f9fafb;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
        ">
          <h3 style="
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #1E3A5F;
          ">${cat.category}</h3>
        </div>
        <div>
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #f5f5f5;
          color: #212121;
          line-height: 1.5;
          max-width: 700px;
          width: 100%;
          overflow-x: hidden;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        @page {
          margin: 10mm;
        }
        @media print {
          body {
            background-color: white;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
        }
        .no-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #1E3A5F 0%, #2E5077 100%);
        padding: 24px 16px;
        color: white;
        margin-bottom: 24px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="display: flex; align-items: flex-start; gap: 16px;">
            ${company?.logo_url
              ? `<img src="${company.logo_url}" alt="${company.name}" style="width: 64px; height: 64px; object-fit: contain; border-radius: 8px; background: white;" />`
              : ''
            }
            <div>
              <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">${company?.name || 'Inspection Report'}</h1>
              <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 4px 0; opacity: 0.95;">Inspection Report</h2>
              <p style="font-size: 14px; opacity: 0.9; margin: 0;">${inspection.project_name}</p>
            </div>
          </div>
          <div style="text-align: right; font-size: 14px; opacity: 0.9;">
            <p style="margin: 0;">Report #${inspection.id.slice(0, 8).toUpperCase()}</p>
            <p style="margin: 4px 0 0 0;">${formatDate(inspection.scheduled_date || inspection.created_at)}</p>
          </div>
        </div>
      </div>

      <!-- Project Info -->
      <div style="
        background: white;
        padding: 24px;
        margin: 0 16px 24px 16px;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      ">
        <h2 style="
          font-size: 18px;
          font-weight: 600;
          color: #1E3A5F;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #1E3A5F;
        ">Project Information</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Address</p>
            <p style="font-size: 14px; color: #374151;">${inspection.project_address || 'N/A'}</p>
          </div>
          <div>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Client</p>
            <p style="font-size: 14px; color: #374151;">${inspection.client_name || 'N/A'}</p>
          </div>
          <div>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Inspection Date</p>
            <p style="font-size: 14px; color: #374151;">${formatDate(inspection.scheduled_date)}</p>
          </div>
          <div>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Inspector</p>
            <p style="font-size: 14px; color: #374151;">${inspection.inspector?.full_name || inspection.hcp_assigned_employee || 'N/A'}</p>
          </div>
        </div>
      </div>

      <!-- Checklist Categories -->
      <div style="margin: 0 16px 24px 16px;">
        <h2 style="
          font-size: 18px;
          font-weight: 600;
          color: #1E3A5F;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #1E3A5F;
        ">Checklist Results</h2>
        ${categoryHtml}
      </div>

      <!-- Notes Section -->
      ${inspection.notes ? `
      <div style="
        background: white;
        padding: 24px;
        margin: 0 16px 24px 16px;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        page-break-inside: avoid;
      ">
        <h2 style="
          font-size: 18px;
          font-weight: 600;
          color: #1E3A5F;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #1E3A5F;
        ">Inspector Notes</h2>
        <p style="
          font-size: 14px;
          color: #374151;
          white-space: pre-wrap;
          line-height: 1.6;
        ">${inspection.notes}</p>
      </div>
      ` : ''}

      ${isChimneyInspection ? `
      <!-- NFPA Reminder -->
      <div style="
        background: #FFF8E1;
        border: 1px solid #FFE082;
        border-left: 4px solid #FFA000;
        padding: 20px 24px;
        margin: 0 16px 24px 16px;
        border-radius: 8px;
        page-break-inside: avoid;
        break-inside: avoid;
      ">
        <p style="
          font-size: 14px;
          color: #5D4037;
          line-height: 1.6;
          margin: 0;
        ">
          <strong>Important:</strong> The National Fire Protection Association (NFPA) Standard 211 states that chimneys, fireplaces, and vents shall be inspected at least once a year for soundness, freedom from deposits, and correct clearances.
        </p>
        <p style="
          font-size: 16px;
          font-weight: 600;
          color: #1E3A5F;
          margin-top: 16px;
          margin-bottom: 0;
        ">
          Your next inspection is recommended by: ${formatDate(getNextYearDate())}
        </p>
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="
        margin: 32px 16px;
        padding-top: 24px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        color: #6b7280;
        font-size: 12px;
        page-break-inside: avoid;
        break-inside: avoid;
      ">
        <p>Report generated on ${generatedDate}</p>
        ${company ? `<p style="margin-top: 4px;">${company.name}${company.phone ? ` | ${company.phone}` : ''}${company.email ? ` | ${company.email}` : ''}</p>` : ''}
        <p style="margin-top: 8px; font-size: 10px; color: #9ca3af;">
          This inspection report was generated using Chimney Inspection Pro
        </p>
      </div>
    </body>
    </html>
  `;
}
