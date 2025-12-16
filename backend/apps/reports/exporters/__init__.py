"""
Report exporters for Excel and CSV output.
"""

from apps.reports.exporters.csv_exporter import (
    CSVExporter,
    export_dict_list_to_csv,
    export_report_to_csv,
)

# Excel exporter is optional - requires openpyxl
try:
    from apps.reports.exporters.excel_exporter import (
        ExcelExporter,
        export_report_to_excel,
    )
    EXCEL_AVAILABLE = True
except ImportError:
    ExcelExporter = None
    export_report_to_excel = None
    EXCEL_AVAILABLE = False

__all__ = [
    'CSVExporter',
    'export_dict_list_to_csv',
    'export_report_to_csv',
    'ExcelExporter',
    'export_report_to_excel',
    'EXCEL_AVAILABLE',
]
