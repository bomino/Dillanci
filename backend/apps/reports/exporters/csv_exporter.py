"""
CSV Exporter for report data.

Provides CSV export functionality for reports.
"""

import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from django.core.files.base import ContentFile


class CSVExporter:
    """
    Exporter for generating CSV reports.

    Handles proper formatting and encoding of data.
    """

    def __init__(self, delimiter: str = ',', encoding: str = 'utf-8-sig'):
        """
        Initialize CSV exporter.

        Args:
            delimiter: CSV field delimiter.
            encoding: Output encoding (utf-8-sig includes BOM for Excel).
        """
        self.delimiter = delimiter
        self.encoding = encoding
        self.buffer = io.StringIO()
        self.writer = csv.writer(self.buffer, delimiter=delimiter)

    def write_row(self, row: list[Any]) -> None:
        """
        Write a single row to the CSV.

        Args:
            row: List of values for the row.
        """
        formatted_row = [self._format_value(v) for v in row]
        self.writer.writerow(formatted_row)

    def write_headers(self, headers: list[str]) -> None:
        """
        Write header row.

        Args:
            headers: List of column headers.
        """
        self.writer.writerow(headers)

    def write_data(self, headers: list[str], data: list[list[Any]]) -> None:
        """
        Write headers and data rows.

        Args:
            headers: List of column headers.
            data: List of rows (each row is a list of values).
        """
        self.write_headers(headers)
        for row in data:
            self.write_row(row)

    def _format_value(self, value: Any) -> str:
        """Format value for CSV output."""
        if value is None:
            return ''
        if isinstance(value, bool):
            return 'Yes' if value else 'No'
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d %H:%M:%S')
        if isinstance(value, date):
            return value.strftime('%Y-%m-%d')
        if isinstance(value, (list, dict)):
            return str(value)
        return str(value)

    def get_content(self) -> str:
        """
        Get the CSV content as string.

        Returns:
            String content of the CSV.
        """
        return self.buffer.getvalue()

    def get_file_content(self) -> bytes:
        """
        Get the CSV content as bytes.

        Returns:
            Bytes content of the CSV file.
        """
        return self.buffer.getvalue().encode(self.encoding)

    def get_content_file(self, filename: str) -> ContentFile:
        """
        Get the CSV as a Django ContentFile.

        Args:
            filename: Name for the file.

        Returns:
            ContentFile instance.
        """
        content = self.get_file_content()
        return ContentFile(content, name=filename)

    def save_to_file(self, filename: str) -> None:
        """
        Save the CSV to a file.

        Args:
            filename: Path to save the file.
        """
        with open(filename, 'w', encoding=self.encoding, newline='') as f:
            f.write(self.buffer.getvalue())


def export_report_to_csv(
    report_data: dict,
    include_summary: bool = True,
) -> bytes:
    """
    Convenience function to export report data to CSV.

    Args:
        report_data: Dict with 'headers', 'data', and optional 'summary'.
        include_summary: Whether to include summary section.

    Returns:
        Bytes content of the CSV file.
    """
    exporter = CSVExporter()

    # Add summary if present and requested
    if include_summary and 'summary' in report_data:
        exporter.write_row(['=== Summary ===', ''])
        for label, value in report_data['summary'].items():
            exporter.write_row([label, exporter._format_value(value)])
        exporter.write_row([])  # Blank line

    # Add main data
    headers = report_data.get('headers', [])
    data = report_data.get('data', [])

    if headers and data:
        if include_summary and 'summary' in report_data:
            exporter.write_row(['=== Data ==='] + [''] * (len(headers) - 1))
        exporter.write_data(headers, data)

    return exporter.get_file_content()


def export_dict_list_to_csv(
    data: list[dict],
    columns: Optional[list[str]] = None,
    column_labels: Optional[dict[str, str]] = None,
) -> bytes:
    """
    Export a list of dictionaries to CSV.

    Args:
        data: List of dictionaries.
        columns: Optional list of columns to include (in order).
        column_labels: Optional mapping of column names to display labels.

    Returns:
        Bytes content of the CSV file.
    """
    if not data:
        return b''

    exporter = CSVExporter()

    # Determine columns
    if columns is None:
        columns = list(data[0].keys())

    # Determine headers
    if column_labels:
        headers = [column_labels.get(col, col) for col in columns]
    else:
        headers = columns

    exporter.write_headers(headers)

    # Write data rows
    for row_dict in data:
        row = [row_dict.get(col, '') for col in columns]
        exporter.write_row(row)

    return exporter.get_file_content()
