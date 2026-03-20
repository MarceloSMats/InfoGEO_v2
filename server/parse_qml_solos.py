"""
parse_qml_solos.py
Extrai mapeamento LEG_DESC -> cor hex do arquivo QML da Embrapa Solos.
Gera: data/embrapa_solos/solos_cores.json
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def parse_qml_colors(qml_path: str) -> dict:
    tree = ET.parse(qml_path)
    root = tree.getroot()

    renderer = root.find('.//renderer-v2')
    if renderer is None:
        print("ERRO: renderer-v2 nao encontrado no QML", file=sys.stderr)
        return {}

    # 1. Mapear symbol_name -> cor hex
    symbol_colors = {}
    for sym in root.findall('.//symbols/symbol'):
        name = sym.get('name', '')
        for prop in sym.findall('.//prop'):
            if prop.get('k') == 'color':
                rgba = prop.get('v', '0,0,0,255').split(',')
                try:
                    r, g, b = int(rgba[0]), int(rgba[1]), int(rgba[2])
                    symbol_colors[name] = f'#{r:02X}{g:02X}{b:02X}'
                except (ValueError, IndexError):
                    symbol_colors[name] = '#CCCCCC'
                break

    # 2. Mapear value (LEG_DESC) -> cor via symbol_name
    cores = {}
    for cat in renderer.findall('.//category'):
        value = cat.get('value', '').strip()
        sym_name = cat.get('symbol', '')
        if value and sym_name in symbol_colors:
            cores[value] = symbol_colors[sym_name]

    return cores


if __name__ == '__main__':
    base = Path(__file__).parent.parent / 'data' / 'embrapa_solos'
    qml_path = base / 'brasil_solos_5m_20201104.qml'
    out_path = base / 'solos_cores.json'

    if not qml_path.exists():
        print(f"ERRO: QML nao encontrado: {qml_path}", file=sys.stderr)
        sys.exit(1)

    cores = parse_qml_colors(str(qml_path))
    out_path.write_text(json.dumps(cores, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"OK: {len(cores)} cores exportadas -> {out_path}")
