import * as React from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Database } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api/client';

export interface ExportColumn {
  key: string;
  header: string;
  formatter?: (value: unknown) => string;
}

export interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  columns: ExportColumn[];
  className?: string;
  disabled?: boolean;
  /** Server-side export URL (e.g., '/api/v1/requisitions/export/') - enables full dataset export */
  serverExportUrl?: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportToCSV(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string
): void {
  const headers = columns.map((col) => escapeCSVValue(col.header)).join(',');

  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        const formatted = col.formatter
          ? col.formatter(value)
          : formatValue(value);
        return escapeCSVValue(formatted);
      })
      .join(',')
  );

  const csvContent = [headers, ...rows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function exportToPDF(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  const doc = printWindow.document;

  // Create document structure using DOM methods
  const html = doc.createElement('html');
  const head = doc.createElement('head');
  const title = doc.createElement('title');
  title.textContent = filename;

  const style = doc.createElement('style');
  style.textContent = `
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 16px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f4f4f4; font-weight: bold; }
    tr:nth-child(even) { background-color: #fafafa; }
    .footer { font-size: 10px; color: #999; margin-top: 16px; }
    @media print {
      body { margin: 0; }
      h1 { font-size: 14px; }
      table { font-size: 10px; }
      th, td { padding: 4px; }
    }
  `;

  head.appendChild(title);
  head.appendChild(style);

  const body = doc.createElement('body');

  // Title
  const h1 = doc.createElement('h1');
  h1.textContent = filename;
  body.appendChild(h1);

  // Meta info
  const meta = doc.createElement('p');
  meta.className = 'meta';
  meta.textContent = `Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;
  body.appendChild(meta);

  // Table
  const table = doc.createElement('table');
  const thead = doc.createElement('thead');
  const headerRow = doc.createElement('tr');

  columns.forEach((col) => {
    const th = doc.createElement('th');
    th.textContent = col.header;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');

  data.forEach((row) => {
    const tr = doc.createElement('tr');
    columns.forEach((col) => {
      const td = doc.createElement('td');
      const value = row[col.key];
      const formatted = col.formatter
        ? col.formatter(value)
        : formatValue(value);
      td.textContent = formatted;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  body.appendChild(table);

  // Footer
  const footer = doc.createElement('p');
  footer.className = 'footer';
  footer.textContent = `Total records: ${data.length}`;
  body.appendChild(footer);

  html.appendChild(head);
  html.appendChild(body);

  // Clear and append to document
  doc.documentElement.replaceWith(html);
  doc.close();

  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

export function ExportButton({
  data,
  filename,
  columns,
  className,
  disabled = false,
  serverExportUrl,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportType, setExportType] = React.useState<'csv' | 'pdf' | 'excel' | 'server-excel' | 'server-csv' | null>(null);

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true);
    setExportType(type);

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      if (type === 'csv') {
        exportToCSV(data, columns, filename);
      } else {
        exportToPDF(data, columns, filename);
      }
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleServerExport = async (format: 'excel' | 'csv') => {
    if (!serverExportUrl) return;

    setIsExporting(true);
    setExportType(format === 'excel' ? 'server-excel' : 'server-csv');

    try {
      const response = await apiClient.get(serverExportUrl, {
        params: { format },
        responseType: 'blob',
      });

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = `${filename}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (filenameMatch) {
          downloadFilename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = new Blob([response.data], {
        type: format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', downloadFilename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Server export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const isDisabled = disabled || (data.length === 0 && !serverExportUrl);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', className)}
          disabled={isDisabled}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Current page exports */}
        {data.length > 0 && (
          <>
            <DropdownMenuItem
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="cursor-pointer"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {isExporting && exportType === 'csv' ? 'Exporting...' : 'Current Page to CSV'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="cursor-pointer"
            >
              <FileText className="mr-2 h-4 w-4" />
              {isExporting && exportType === 'pdf' ? 'Exporting...' : 'Current Page to PDF'}
            </DropdownMenuItem>
          </>
        )}

        {/* Server-side exports (full dataset) */}
        {serverExportUrl && (
          <>
            {data.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => handleServerExport('excel')}
              disabled={isExporting}
              className="cursor-pointer"
            >
              <Database className="mr-2 h-4 w-4" />
              {isExporting && exportType === 'server-excel' ? 'Exporting...' : 'All Data to Excel'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleServerExport('csv')}
              disabled={isExporting}
              className="cursor-pointer"
            >
              <Database className="mr-2 h-4 w-4" />
              {isExporting && exportType === 'server-csv' ? 'Exporting...' : 'All Data to CSV'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportButton;
