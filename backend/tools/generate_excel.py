"""
Generate Excel Tool

Builds a CSV download from table-like data already present
in tool context (e.g., compare_entities output).
"""

import csv
import io
from typing import Any


def _extract_latest_table(context: dict[str, Any]) -> dict[str, Any] | None:
    """Get the most recent table_data object from prior step results."""
    if not context:
        return None

    step_ids = sorted(context.keys(), reverse=True)
    for step_id in step_ids:
        result = context.get(step_id, {})
        data = result.get("data", {})
        if isinstance(data, dict):
            table_data = data.get("table_data")
            if isinstance(table_data, dict):
                return table_data
    return None


def _table_to_csv(table_data: dict[str, Any]) -> str:
    """Convert table data to proper CSV string."""
    columns = table_data.get("columns", [])
    rows = table_data.get("rows", [])

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue()


class GenerateExcelTool:
    name: str = "generate_excel"
    description: str = "Generate a CSV download from latest table results. Opens in Excel, Google Sheets, etc."

    async def execute(self, params: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        context = context or {}
        title = (params.get("title") or "SportScout Export").strip()
        filename = (params.get("filename") or "sportscout-export.csv").strip()
        # Ensure .csv extension
        if filename.lower().endswith(".xls") or filename.lower().endswith(".xlsx"):
            filename = filename.rsplit(".", 1)[0] + ".csv"
        if not filename.lower().endswith(".csv"):
            filename = f"{filename}.csv"

        table_data = _extract_latest_table(context)
        if not table_data:
            raise ValueError("No table data found in context. Run a comparison first.")

        content = _table_to_csv(table_data)
        summary = f"Generated CSV file '{filename}' — ready for download."

        return {
            "data": {
                "filename": filename,
                "title": title,
                "rows": len(table_data.get("rows", [])),
                "columns": len(table_data.get("columns", [])),
            },
            "summary": summary,
            "client_action": {
                "type": "download_file",
                "payload": {
                    "filename": filename,
                    "content": content,
                    "mime_type": "text/csv",
                },
            },
        }
