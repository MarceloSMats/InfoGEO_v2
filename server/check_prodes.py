"""
Validação do raster PRODES/EUDR.
Verifica CRS, resolução, NoData, overviews e valores únicos.
"""

import sys
from pathlib import Path

import rasterio
import numpy as np

# Paths possíveis
BASE_DIR = Path(__file__).parent.parent
PRODES_COG = BASE_DIR / "data" / "prodes_brasil" / "prodes_brasil_cog.tif"
PRODES_TIF = BASE_DIR / "data" / "prodes_brasil" / "prodes_brasil.tif"

raster_path = PRODES_COG if PRODES_COG.exists() else PRODES_TIF

if not raster_path.exists():
    print(f"ERRO: Raster PRODES não encontrado em {PRODES_TIF}")
    sys.exit(1)

print(f"Raster: {raster_path}")
print(f"Tamanho: {raster_path.stat().st_size / (1024 * 1024):.1f} MB")
print("-" * 60)

with rasterio.open(str(raster_path)) as src:
    print(f"Driver:      {src.driver}")
    print(f"CRS:         {src.crs}")
    print(f"Dimensões:   {src.width} x {src.height} pixels")
    print(f"Bandas:      {src.count}")
    print(f"Dtype:       {src.dtypes[0]}")
    print(f"Resolução:   {src.res[0]:.8f} x {src.res[1]:.8f}")
    print(f"Bounds:      {src.bounds}")
    print(f"NoData:      {src.nodata}")
    print(f"Overviews:   {src.overviews(1) or 'Nenhum (não é COG)'}")

    # Verificar se é COG
    is_cog = len(src.overviews(1)) > 0
    print(f"É COG:       {'Sim' if is_cog else 'Não'}")

    # Ler amostra central para valores únicos
    cx, cy = src.width // 2, src.height // 2
    size = min(5000, src.width // 4)
    window = rasterio.windows.Window(cx - size // 2, cy - size // 2, size, size)
    data = src.read(1, window=window)
    unique_vals = np.unique(data)

    print(f"\nValores únicos (amostra central {size}x{size}):")
    print(f"  {unique_vals}")

    # Verificar conflito NoData vs pixel 0
    print(f"\n--- ANALISE NODATA vs PIXEL 0 ---")
    if src.nodata is None:
        print("  NoData = None -> pixel 0 e classe valida (d2000)")
        print("  OK: _fractional_stats com include_zero_class=True funcionara corretamente")
    elif int(src.nodata) == 0:
        print("  ALERTA: NoData = 0 -> conflito com classe d2000!")
        print("  Necessario usar mascara explicita ou redefinir NoData do raster")
    else:
        print(f"  NoData = {src.nodata} -> sem conflito com pixel 0")

    # Contagem de pixels por classe (amostra)
    print(f"\nDistribuição na amostra:")
    for val in sorted(unique_vals):
        count = int(np.sum(data == val))
        pct = count / data.size * 100
        print(f"  Pixel {val:>3d}: {count:>10,d} pixels ({pct:>5.1f}%)")
