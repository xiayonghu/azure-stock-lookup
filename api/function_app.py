import azure.functions as func
import datetime
import decimal
import json
import logging
import os
import re

import pyodbc

app = func.FunctionApp()

# Table names can't be passed as query parameters, so only allow plain
# identifiers like "Stocks" or "dbo.Stocks".
_TABLE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$")
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9.\-]{1,15}$")


def _connection_string() -> str:
    # SQL_CONNECTION_STRING holds driver/server/database; credentials are kept separately.
    conn_str = os.environ["SQL_CONNECTION_STRING"].rstrip(";")
    username = os.environ.get("SQL_USERNAME")
    password = os.environ.get("SQL_PASSWORD")
    if username and password:
        conn_str += f";UID={username};PWD={{{password.replace('}', '}}')}}}"
    return conn_str


def _quoted_table_name() -> str:
    table = os.environ.get("SQL_TABLE_NAME", "dbo.Stocks")
    if not _TABLE_NAME_RE.match(table):
        raise ValueError(f"Invalid SQL_TABLE_NAME: {table!r}")
    return ".".join(f"[{part}]" for part in table.split("."))


def _to_json(value):
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (datetime.date, datetime.datetime, datetime.time)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.hex()
    raise TypeError(f"Type {type(value).__name__} is not JSON serializable")


def _json_response(body, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(body, default=_to_json),
        status_code=status_code,
        mimetype="application/json",
    )


@app.route(route="stock/{symbol}", methods=["GET"], auth_level=func.AuthLevel.FUNCTION)
def GetStock(req: func.HttpRequest) -> func.HttpResponse:
    symbol = req.route_params.get("symbol", "").strip().upper()
    if not _SYMBOL_RE.match(symbol):
        return _json_response({"error": "Invalid stock symbol."}, 400)

    symbol_column = os.environ.get("SQL_SYMBOL_COLUMN", "Symbol")
    if not _TABLE_NAME_RE.match(symbol_column) or "." in symbol_column:
        logging.error("Invalid SQL_SYMBOL_COLUMN: %r", symbol_column)
        return _json_response({"error": "Server configuration error."}, 500)

    try:
        query = f"SELECT * FROM {_quoted_table_name()} WHERE [{symbol_column}] = ?"
        with pyodbc.connect(_connection_string(), timeout=30) as conn:
            cursor = conn.cursor()
            cursor.execute(query, symbol)
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    except (KeyError, ValueError):
        logging.exception("Missing or invalid SQL configuration.")
        return _json_response({"error": "Server configuration error."}, 500)
    except pyodbc.Error:
        logging.exception("Database query failed for symbol %s.", symbol)
        return _json_response({"error": "Database query failed."}, 500)

    if not rows:
        return _json_response({"symbol": symbol, "error": "Symbol not found."}, 404)

    logging.info("Returned %d row(s) for %s.", len(rows), symbol)
    return _json_response({"symbol": symbol, "count": len(rows), "results": rows})
