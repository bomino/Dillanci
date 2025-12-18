"""
Export mixin for ViewSets.

Provides Excel and CSV export functionality for list views.
"""

from django.http import HttpResponse
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.reports.exporters.excel_exporter import ExcelExporter, OPENPYXL_AVAILABLE
from apps.reports.exporters.csv_exporter import CSVExporter


class ExportMixin:
    """
    Mixin to add export functionality to ViewSets.

    Subclasses should define:
    - export_filename: str - Base filename for exports
    - export_fields: list[tuple[str, str]] - List of (field_name, display_name) tuples

    Optional:
    - get_export_queryset() - Returns filtered queryset for export
    - get_export_value(obj, field) - Custom value extraction
    """

    export_filename = 'export'
    export_fields = []

    def get_export_queryset(self):
        """Get the queryset for export. Override for custom filtering."""
        return self.filter_queryset(self.get_queryset())

    def get_export_value(self, obj, field_name):
        """
        Get the value for a field from an object.
        Override for custom value extraction.
        """
        value = obj
        for part in field_name.split('__'):
            if value is None:
                return ''
            if hasattr(value, part):
                value = getattr(value, part)
            elif isinstance(value, dict):
                value = value.get(part, '')
            else:
                return ''

        # Format special types
        if value is None:
            return ''
        if hasattr(value, 'isoformat'):  # datetime/date
            return value.isoformat()
        if hasattr(value, '__iter__') and not isinstance(value, (str, dict)):
            return ', '.join(str(v) for v in value)

        return value

    def get_export_row(self, obj):
        """Get a single row of data for export."""
        return [self.get_export_value(obj, field) for field, _ in self.export_fields]

    def get_export_headers(self):
        """Get the headers for export."""
        return [display for _, display in self.export_fields]

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        """
        Export data to Excel or CSV.

        Query params:
        - format: 'excel' or 'csv' (default: 'excel')
        """
        export_format = request.query_params.get('format', 'excel').lower()

        if export_format not in ('excel', 'csv'):
            return Response(
                {'error': 'Invalid format. Use "excel" or "csv".'},
                status=400
            )

        # Get data
        queryset = self.get_export_queryset()
        headers = self.get_export_headers()
        data = [self.get_export_row(obj) for obj in queryset]

        if export_format == 'excel':
            return self._export_excel(headers, data)
        else:
            return self._export_csv(headers, data)

    def _export_excel(self, headers, data):
        """Generate Excel file response."""
        if not OPENPYXL_AVAILABLE:
            return Response(
                {'error': 'Excel export not available. openpyxl not installed.'},
                status=500
            )

        exporter = ExcelExporter()
        exporter.add_sheet(self.export_filename, headers, data)
        content = exporter.get_file_content()

        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{self.export_filename}.xlsx"'
        return response

    def _export_csv(self, headers, data):
        """Generate CSV file response."""
        exporter = CSVExporter()
        exporter.write_data(headers, data)
        content = exporter.get_file_content()

        response = HttpResponse(content, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{self.export_filename}.csv"'
        return response
