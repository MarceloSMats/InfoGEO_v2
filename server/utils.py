# -*- coding: utf-8 -*-
"""
InfoGEO – Utilitários de formatação e serialização JSON
========================================================
Reúne helpers reutilizáveis: sanitização de objetos para JSON,
formatação numérica pt-BR, coordenadas GMS, etc.
"""

import re
import numpy as np
import pandas as pd


# ------------------------------------------------------------------------------
# JSON sanitization helpers
# ------------------------------------------------------------------------------
def _make_json_friendly(obj):
    """Recursively convert numpy / pandas / other non-serializable types to native Python types."""
    try:
        if obj is None:
            return None

        if isinstance(obj, (str, bool, int, float)):
            return obj

        if isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        if isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)

        try:
            if isinstance(obj, pd.Timestamp):
                return obj.isoformat()
        except Exception:
            pass

        if isinstance(obj, dict):
            return {str(k): _make_json_friendly(v) for k, v in obj.items()}

        if isinstance(obj, (list, tuple, set)):
            return [_make_json_friendly(v) for v in obj]

        try:
            if isinstance(obj, pd.Series):
                return {
                    str(k): _make_json_friendly(v) for k, v in obj.to_dict().items()
                }
        except Exception:
            pass

        if isinstance(obj, (np.ndarray,)):
            return [_make_json_friendly(v) for v in obj.tolist()]

        return str(obj)
    except Exception:
        try:
            return str(obj)
        except Exception:
            return None


def _sanitize_response(resp: dict) -> dict:
    """Sanitize a top-level response dict recursively to make it JSON-serializable."""
    if not isinstance(resp, dict):
        return _make_json_friendly(resp)
    out = {}
    for k, v in resp.items():
        out[str(k)] = _make_json_friendly(v)
    return out


# ------------------------------------------------------------------------------
# Formatação numérica pt-BR
# ------------------------------------------------------------------------------
def _format_number_ptbr(x, decimals=2, currency=False):
    """Format number using pt-BR conventions: thousands '.' and decimal ','.
    If currency=True, prefix with 'R$ '. Returns string or None if x is None."""
    try:
        if x is None:
            return None
        val = float(x)
        int_part = int(abs(val))
        frac = abs(val) - int_part
        int_str = f"{int_part:,}".replace(",", ".")
        frac_str = f"{frac:.{decimals}f}"[1:].replace(".", ",")
        sign = "-" if val < 0 else ""
        s = f"{sign}{int_str}{frac_str}"
        if currency:
            return f"R$ {s}"
        return s
    except Exception:
        try:
            return str(x)
        except Exception:
            return None


def _format_area_ha(x, decimals=2):
    if x is None:
        return None
    s = _format_number_ptbr(x, decimals)
    return f"{s} ha" if s is not None else None


def _format_percent(x, decimals=2):
    if x is None:
        return None
    s = _format_number_ptbr(x, decimals)
    return f"{s}%" if s is not None else None


# ------------------------------------------------------------------------------
# Parse numérico pt-BR (robusto)
# ------------------------------------------------------------------------------
def _parse_number_ptbr(v):
    """Parse a pt-BR formatted number string into float. Returns None on failure."""
    if v is None:
        return None
    if isinstance(v, (int, float, np.integer, np.floating)):
        return float(v)
    s = str(v).strip()
    s = s.replace("R$", "").replace("\xa0", "").strip()
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg = True
        s = s[1:-1]
    if "." in s and "," in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        if "," in s and "." not in s:
            s = s.replace(",", ".")
    s = re.sub(r"[^0-9\.-]", "", s)
    if s == "" or s == "." or s == "-":
        return None
    try:
        num = float(s)
        return -num if neg else num
    except Exception:
        return None


# ------------------------------------------------------------------------------
# Coordenadas
# ------------------------------------------------------------------------------
def decimal_to_gms(decimal, is_latitude):
    """Converte decimal para graus, minutos, segundos"""
    abs_decimal = abs(decimal)
    degrees = int(abs_decimal)
    minutes_float = (abs_decimal - degrees) * 60
    minutes = int(minutes_float)
    seconds = round((minutes_float - minutes) * 60, 2)

    direction = (
        "N"
        if (is_latitude and decimal >= 0)
        else "S"
        if (is_latitude and decimal < 0)
        else "E"
        if (not is_latitude and decimal >= 0)
        else "W"
    )

    return f"{degrees}° {minutes}' {seconds}\" {direction}"
