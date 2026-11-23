"""Convert the supplied source photos into responsive WebP sets in assets/images.
Originals in Images/ and 'Aerial & Adventure Activities/' are never modified.
Usage: python tools/build-images.py
"""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTHS = [480, 800, 1200, 1600]

MAP = {
  "hotel": {
    "lobby-reception":   "Images/reception area (2).png",
    "reception-desk":    "Images/reception area (1).png",
    "lobby-lounge":      "Images/Front.jpg",
    "double-twin-room":  "Images/Rooms (1).jpeg",
    "double-room":       "Images/Rooms (1).jpg",
    "twin-room":         "Images/Rooms (2).jpg",
    "double-single-room":"Images/Rooms (2).webp",
    "twin-room-2":       "Images/Rooms (4).jpeg",
    "room-interior":     "Images/Rooms (7).jpeg",
    "shared-bunk-room":  "Images/Sharing Beds (1).jpg",
    "bathroom":          "Images/images (4).jpg",
    "dining-area":       "Images/images (6).jpg",
    "kitchen":           "Images/images (5).jpg",
  },
  "adventures": {
    "paragliding-pokhara":     "Aerial & Adventure Activities/Paragliding (1).webp",
    "helicopter-flight":       "Aerial & Adventure Activities/Mountain & Helicopter Flights.webp",
    "bungee-jumping":          "Aerial & Adventure Activities/Bungee Jumping .webp",
    "trekking-himalaya":       "Aerial & Adventure Activities/Trekking & Day Hikes.webp",
    "kathmandu-valley-landmarks": "Aerial & Adventure Activities/Kathmandu Valley Landmarks.jpg",
    "jungle-safari-chitwan":   "Aerial & Adventure Activities/Jungle Safaris.jpg",
    "nepali-momos":            "Aerial & Adventure Activities/Local Food.webp",
  },
}

manifest = {}
for group, items in MAP.items():
    out_dir = os.path.join(ROOT, "assets", "images", group)
    os.makedirs(out_dir, exist_ok=True)
    for name, src in items.items():
        im = Image.open(os.path.join(ROOT, src)).convert("RGB")
        w, h = im.size
        sizes = [x for x in WIDTHS if x < w] + [min(w, 1600)]
        sizes = sorted(set(sizes))
        for sw in sizes:
            sh = round(h * sw / w)
            im.resize((sw, sh), Image.LANCZOS).save(
                os.path.join(out_dir, f"{name}-{sw}.webp"), "WEBP", quality=80, method=6)
        manifest[f"{group}/{name}"] = {"w": w if w <= 1600 else 1600, "h": round(h * min(w,1600) / w), "sizes": sizes}

# Social sharing image (1200x630 JPEG)
im = Image.open(os.path.join(ROOT, MAP["hotel"]["lobby-reception"])).convert("RGB")
w, h = im.size; th = round(w * 630 / 1200)
top = max(0, (h - th) // 2)
im.crop((0, top, w, top + th)).resize((1200, 630), Image.LANCZOS).save(
    os.path.join(ROOT, "assets", "images", "og-image.jpg"), "JPEG", quality=82, optimize=True)

print(json.dumps(manifest, indent=1))
