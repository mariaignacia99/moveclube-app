import os, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_appstore_screenshot(raw_img_path, output_path, badge_text, title_text, subtitle_text, width=1284, height=2778):
    bg = Image.new("RGB", (width, height), (248, 250, 252))
    draw = ImageDraw.Draw(bg)

    # Subtle athletic gradient at the top
    for y in range(480):
        alpha = y / 480
        r = int(235 + (248 - 235) * alpha)
        g = int(245 + (250 - 245) * alpha)
        b = int(255 + (252 - 255) * alpha)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Fonts
    font_title_path = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    font_reg_path = "/System/Library/Fonts/Helvetica.ttc"
    
    try:
        font_badge = ImageFont.truetype(font_title_path, 32)
        font_title = ImageFont.truetype(font_title_path, 72)
        font_sub = ImageFont.truetype(font_reg_path, 38)
    except:
        font_badge = ImageFont.load_default()
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    # Draw Header Badge
    badge_w = draw.textlength(badge_text, font=font_badge) + 64
    badge_h = 60
    badge_x = (width - badge_w) // 2
    badge_y = 120
    draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_w, badge_y + badge_h], radius=30, fill=(238, 242, 255), outline=(99, 102, 241), width=2)
    draw.text((badge_x + 32, badge_y + 13), badge_text, font=font_badge, fill=(67, 56, 202))

    # Draw Title
    title_w = draw.textlength(title_text, font=font_title)
    title_x = (width - title_w) // 2
    title_y = 215
    draw.text((title_x, title_y), title_text, font=font_title, fill=(15, 23, 42))

    # Draw Subtitle
    sub_w = draw.textlength(subtitle_text, font=font_sub)
    sub_x = (width - sub_w) // 2
    sub_y = 315
    draw.text((sub_x, sub_y), subtitle_text, font=font_sub, fill=(100, 116, 139))

    # Device Mockup with App Screenshot
    if os.path.exists(raw_img_path):
        raw_screen = Image.open(raw_img_path).convert("RGBA")
        
        dev_w = 1040
        dev_h = int(dev_w * (raw_screen.height / raw_screen.width))
        dev_x = (width - dev_w) // 2
        dev_y = 440

        screen_resized = raw_screen.resize((dev_w, dev_h), Image.Resampling.LANCZOS)

        mask = Image.new("L", (dev_w, dev_h), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, dev_w, dev_h], radius=56, fill=255)

        # Shadow beneath device
        shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.rounded_rectangle([dev_x - 8, dev_y - 2, dev_x + dev_w + 8, dev_y + dev_h + 12], radius=64, fill=(15, 23, 42, 60))
        shadow = shadow.filter(ImageFilter.GaussianBlur(30))
        bg.paste(shadow, (0, 0), shadow)

        # Outer Phone Bezel Border
        bezel_margin = 12
        draw.rounded_rectangle([dev_x - bezel_margin, dev_y - bezel_margin, dev_x + dev_w + bezel_margin, min(height, dev_y + dev_h + bezel_margin)], radius=66, fill=(15, 23, 42))

        # Paste App Screen
        bg.paste(screen_resized, (dev_x, dev_y), mask)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bg.save(output_path, "PNG", optimize=True)
    print(f"Generated: {output_path} ({width}x{height})")

if __name__ == "__main__":
    configs = [
        {
            "raw": "screenshots_appstore/screen1_raw.png",
            "out": "screenshots_appstore/iphone_6_5/1_Explorar_MoveClub.png",
            "badge": "MEMBRESIA DEPORTIVA TODO EN UNO",
            "title": "Explora y Reserva en Clubes",
            "sub": "Pádel, Pilates, CrossFit y Gimnasios con 1 solo pase"
        },
        {
            "raw": "screenshots_appstore/screen2_raw.png",
            "out": "screenshots_appstore/iphone_6_5/2_Canchas_Padel.png",
            "badge": "CANCHAS & CLINICAS EN VIVO",
            "title": "Entrena en los Mejores Centros",
            "sub": "Horarios en tiempo real, instructores y reservas directas"
        },
        {
            "raw": "screenshots_appstore/screen3_raw.png",
            "out": "screenshots_appstore/iphone_6_5/3_Pase_Digital_QR.png",
            "badge": "ACCESO RAPIDO SIN ESPERAS",
            "title": "Tu Pase Digital QR Instantáneo",
            "sub": "Muestra tu código en recepción y empieza a entrenar"
        },
        {
            "raw": "screenshots_appstore/screen4_raw.png",
            "out": "screenshots_appstore/iphone_6_5/4_Coach_IA.png",
            "badge": "INTELIGENCIA ARTIFICIAL 24/7",
            "title": "Coach IA MoveClub",
            "sub": "Consulta reservas, balance de créditos y rollover al instante"
        },
        {
            "raw": "screenshots_appstore/screen5_raw.png",
            "out": "screenshots_appstore/iphone_6_5/5_Planes_Creditos.png",
            "badge": "CREDITOS Y MEMBRESIAS",
            "title": "Planes Flexibles y Rollover",
            "sub": "Tus créditos no utilizados se acumulan para el próximo mes"
        }
    ]

    for cfg in configs:
        create_appstore_screenshot(
            raw_img_path=cfg["raw"],
            output_path=cfg["out"],
            badge_text=cfg["badge"],
            title_text=cfg["title"],
            subtitle_text=cfg["sub"],
            width=1284,
            height=2778
        )

    # Also generate iPad 13-inch versions (2048 x 2732 px)
    ipad_dir = "screenshots_appstore/ipad_13"
    os.makedirs(ipad_dir, exist_ok=True)
    for cfg in configs:
        filename = os.path.basename(cfg["out"])
        ipad_out = os.path.join(ipad_dir, filename)
        create_appstore_screenshot(
            raw_img_path=cfg["raw"],
            output_path=ipad_out,
            badge_text=cfg["badge"],
            title_text=cfg["title"],
            subtitle_text=cfg["sub"],
            width=2048,
            height=2732
        )

    # Copy to user Desktop for instant access
    desktop_dir = "/Users/nachasanchezhenriquez/Desktop/MoveClub_AppStore_Screenshots"
    os.makedirs(os.path.join(desktop_dir, "iPhone_6_5"), exist_ok=True)
    os.makedirs(os.path.join(desktop_dir, "iPad_13"), exist_ok=True)

    for cfg in configs:
        filename = os.path.basename(cfg["out"])
        shutil.copy(cfg["out"], os.path.join(desktop_dir, "iPhone_6_5", filename))
        shutil.copy(os.path.join(ipad_dir, filename), os.path.join(desktop_dir, "iPad_13", filename))

    print(f"\nSUCCESS! All screenshots saved in Desktop at: {desktop_dir}")
