#!/usr/bin/env python3
import zlib
import struct
import math
import os

def create_png(width, height, pixels):
    def make_chunk(chunk_type, data):
        crc = zlib.crc32(chunk_type + data) & 0xffffffff
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = make_chunk(b'IHDR', struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) # 8-bit RGB

    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter byte 0 (None)
        for x in range(width):
            r, g, b = pixels[y * width + x]
            raw_data.extend((r, g, b))

    compressed = zlib.compress(bytes(raw_data), 9)
    idat = make_chunk(b'IDAT', compressed)
    iend = make_chunk(b'IEND', b'')

    return header + ihdr + idat + iend

def generate_moveclub_icon(size):
    pixels = []
    center_x = size / 2.0
    center_y = size / 2.0

    for y in range(size):
        ny = y / float(size)
        for x in range(size):
            nx = x / float(size)
            
            # Premium Gradient: Indigo (#4f46e5) to Slate (#0f172a)
            r = int((79 * (1 - ny) + 15 * ny))
            g = int((70 * (1 - ny) + 23 * ny))
            b = int((229 * (1 - ny) + 42 * ny))

            # Add stylish central rounded square badge / lightning
            dx = (x - center_x) / (size * 0.35)
            dy = (y - center_y) / (size * 0.35)
            dist = math.sqrt(dx*dx + dy*dy)

            # Central Glow & Zap icon shape
            if abs(dx) < 0.65 and abs(dy) < 0.65:
                # Add inner glow
                glow = 1.0 - (dist / 1.0)
                if glow > 0:
                    r = min(255, int(r + 60 * glow))
                    g = min(255, int(g + 50 * glow))
                    b = min(255, int(b + 30 * glow))

            # Draw stylized 'M' & Lightning bolt
            # Diagonal lines
            m_dist = abs((x - center_x) * 0.8) + abs(y - center_y) * 0.5
            if abs(x - center_x) < size * 0.22 and abs(y - center_y) < size * 0.22:
                # White emblem
                if (x + y) % int(size * 0.08) < int(size * 0.04) or dist < 0.4:
                    r = min(255, r + 80)
                    g = min(255, g + 80)
                    b = min(255, b + 100)

            pixels.append((r, g, b))

    return create_png(size, size, pixels)

def main():
    icon_dir = os.path.join(os.path.dirname(__file__), "ios/MoveClub/Assets.xcassets/AppIcon.appiconset")
    os.makedirs(icon_dir, exist_ok=True)

    sizes = [
        ("icon_1024.png", 1024),
        ("icon_180.png", 180),
        ("icon_167.png", 167),
        ("icon_152.png", 152),
        ("icon_120.png", 120),
        ("icon_87.png", 87),
        ("icon_80.png", 80),
        ("icon_76.png", 76),
        ("icon_60.png", 60),
        ("icon_58.png", 58),
        ("icon_40.png", 40),
        ("icon_29.png", 29),
        ("icon_20.png", 20)
    ]

    for filename, s in sizes:
        png_bytes = generate_moveclub_icon(s)
        path = os.path.join(icon_dir, filename)
        with open(path, "wb") as f:
            f.write(png_bytes)
        print(f"Generated {filename} ({s}x{s})")

    # Write complete Contents.json matching Apple App Store requirements
    contents_json = {
        "images": [
            { "filename": "icon_1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024" },
            { "filename": "icon_180.png", "idiom": "iphone", "scale": "3x", "size": "60x60" },
            { "filename": "icon_120.png", "idiom": "iphone", "scale": "2x", "size": "60x60" },
            { "filename": "icon_87.png", "idiom": "iphone", "scale": "3x", "size": "29x29" },
            { "filename": "icon_58.png", "idiom": "iphone", "scale": "2x", "size": "29x29" },
            { "filename": "icon_120.png", "idiom": "iphone", "scale": "3x", "size": "40x40" },
            { "filename": "icon_80.png", "idiom": "iphone", "scale": "2x", "size": "40x40" },
            { "filename": "icon_60.png", "idiom": "iphone", "scale": "3x", "size": "20x20" },
            { "filename": "icon_40.png", "idiom": "iphone", "scale": "2x", "size": "20x20" },
            { "filename": "icon_167.png", "idiom": "ipad", "scale": "2x", "size": "83.5x83.5" },
            { "filename": "icon_152.png", "idiom": "ipad", "scale": "2x", "size": "76x76" },
            { "filename": "icon_76.png", "idiom": "ipad", "scale": "1x", "size": "76x76" },
            { "filename": "icon_80.png", "idiom": "ipad", "scale": "2x", "size": "40x40" },
            { "filename": "icon_40.png", "idiom": "ipad", "scale": "1x", "size": "40x40" },
            { "filename": "icon_58.png", "idiom": "ipad", "scale": "2x", "size": "29x29" },
            { "filename": "icon_29.png", "idiom": "ipad", "scale": "1x", "size": "29x29" },
            { "filename": "icon_40.png", "idiom": "ipad", "scale": "2x", "size": "20x20" },
            { "filename": "icon_20.png", "idiom": "ipad", "scale": "1x", "size": "20x20" }
        ],
        "info": {
            "author": "xcode",
            "version": 1
        }
    }

    import json
    with open(os.path.join(icon_dir, "Contents.json"), "w") as f:
        json.dump(contents_json, f, indent=2)
    print("Contents.json updated successfully!")

if __name__ == "__main__":
    main()
