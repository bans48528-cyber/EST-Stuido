"""Build platform icons from the supplied ATC PNG artwork (requires Pillow)."""
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]


def build_icons(source, ico_paths, icns_path):
    image = Image.open(ROOT / source).convert("RGBA")
    square = ImageOps.pad(image, (1024, 1024), method=Image.Resampling.LANCZOS)
    for target in ico_paths:
        square.save(ROOT / target, format="ICO", sizes=[(size, size) for size in SIZES])
    square.save(ROOT / icns_path, format="ICNS")
    return image


def main():
    app_image = build_icons(
        "src/icon/OpenBlockDesktop.png",
        ["src/icon/OpenBlockDesktop.ico", "buildResources/OpenBlockDesktop.ico"],
        "buildResources/OpenBlockDesktop.icns",
    )
    build_icons(
        "src/icon/ATCProject.png",
        ["buildResources/OpenBlockFile.ico"],
        "buildResources/OpenBlockFile.icns",
    )
    (ROOT / "buildResources/OpenBlockFile.png").write_bytes((ROOT / "src/icon/ATCProject.png").read_bytes())
    for name, size in {
        "linux/512x512.png": (512, 512),
        "appx/Square44x44Logo.png": (44, 44),
        "appx/StoreLogo.png": (50, 50),
        "appx/Square150x150Logo.png": (150, 150),
        "appx/Wide310x150Logo.png": (310, 150),
    }.items():
        output = ROOT / "buildResources" / name
        output.parent.mkdir(parents=True, exist_ok=True)
        ImageOps.pad(app_image, size, method=Image.Resampling.LANCZOS).save(output)
    print("ATC application and project icons generated for Windows, macOS, Linux and AppX.")


if __name__ == "__main__":
    main()
