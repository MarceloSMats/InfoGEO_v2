import rasterio
import numpy as np

with open('server/classes_output.txt', 'w') as f:
    try:
        with rasterio.open('data/Aptidao_5Classes_majorado_r2.tif') as src:
            f.write(f"Profile: {src.profile}\n")
            f.write(f"Tags: {src.tags()}\n")
            try:
                colormap = src.colormap(1)
                f.write(f"Colormap: {colormap}\n")
            except Exception as e:
                f.write(f"Colormap Error: {e}\n")
                
            # Read a small window to see values
            window = rasterio.windows.Window(src.width//2, src.height//2, min(5000, src.width//2), min(5000, src.height//2))
            data = src.read(1, window=window)
            unique_vals = np.unique(data)
            f.write(f"Unique values in sample: {unique_vals}\n")
    except Exception as e:
        f.write(f"Error: {e}\n")
