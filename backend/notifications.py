"""
MoveClub Notifications & Communications Module
Generates responsive HTML email templates, Google Calendar links, Apple iCal files, and WhatsApp reminders.
"""

import urllib.parse
from datetime import datetime, timedelta

def build_google_calendar_url(title, studio_name, address, start_time_str, duration_minutes=50, qr_code=""):
    """
    Builds a pre-filled Google Calendar event URL.
    start_time_str format: 'YYYY-MM-DD HH:MM'
    """
    try:
        dt = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M")
    except Exception:
        dt = datetime.now() + timedelta(days=1)
    
    end_dt = dt + timedelta(minutes=duration_minutes)
    
    start_fmt = dt.strftime("%Y%m%dT%H%M%S")
    end_fmt = end_dt.strftime("%Y%m%dT%H%M%S")
    dates_param = f"{start_fmt}/{end_fmt}"
    
    event_title = f"MoveClub: {title} @ {studio_name}"
    description = f"Tu clase reservada con MoveClub en {studio_name}.\nDirección: {address}\nPase Digital QR: {qr_code}\n\n¡Llega 10 minutos antes y presenta tu Pase en recepción!"
    
    params = {
        "action": "TEMPLATE",
        "text": event_title,
        "dates": dates_param,
        "details": description,
        "location": f"{studio_name}, {address}",
        "sprop": "website:moveclub.cl"
    }
    return f"https://calendar.google.com/calendar/render?{urllib.parse.urlencode(params)}"

def build_ical_content(title, studio_name, address, start_time_str, duration_minutes=50, qr_code="", booking_id=1):
    """
    Generates standard RFC-5545 iCalendar (.ics) string for Apple Calendar / Outlook.
    """
    try:
        dt = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M")
    except Exception:
        dt = datetime.now() + timedelta(days=1)
    
    end_dt = dt + timedelta(minutes=duration_minutes)
    dtstamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    dtstart = dt.strftime("%Y%m%dT%H%M%S")
    dtend = end_dt.strftime("%Y%m%dT%H%M%S")
    
    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MoveClub Chile//MoveClub App//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:moveclub-booking-{booking_id}-{dtstart}@moveclub.cl",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"SUMMARY:MoveClub: {title} @ {studio_name}",
        f"DESCRIPTION:Clase confirmada en MoveClub.\\nPase QR: {qr_code}\\nEstudio: {studio_name}\\nDirección: {address}",
        f"LOCATION:{studio_name}, {address}",
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "TRIGGER:-PT2H",
        "ACTION:DISPLAY",
        "DESCRIPTION:Recordatorio MoveClub: Tu clase comienza en 2 horas",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ]
    return "\r\n".join(ics_lines)

def generate_booking_confirmation_email_html(booking_dict, user_name="Atleta MoveClub"):
    """
    Returns a responsive, beautiful HTML email for booking confirmation with QR code and Google Calendar button.
    """
    b = booking_dict
    studio_name = b.get("studio_name", "Estudio Asociado")
    class_title = b.get("class_title") or b.get("title", "Clase MoveClub")
    category = b.get("category", "Fitness")
    start_time = b.get("start_time", "Hoy")
    address = b.get("studio_address") or b.get("address", "Osorno, Chile")
    qr_code = b.get("qr_code_id") or b.get("qr_code", "MC-PASS-2026")
    credits_spent = b.get("total_credits_spent") or b.get("credit_cost", 5)
    spots = b.get("spots_count", 1)
    studio_image = b.get("studio_image") or "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80"
    
    gcal_url = build_google_calendar_url(class_title, studio_name, address, start_time, qr_code=qr_code)
    qr_img_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={urllib.parse.quote(qr_code)}"

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Confirmada MoveClub</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }}
    .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }}
    .header {{ background: linear-gradient(135deg, #090d16 0%, #1e1b4b 100%); padding: 32px 24px; text-align: center; color: white; }}
    .logo {{ font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }}
    .logo span {{ color: #2dd4bf; }}
    .content {{ padding: 28px 24px; }}
    .badge {{ display: inline-block; padding: 4px 12px; border-radius: 999px; background: #ccfbf1; color: #0f766e; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }}
    .hero-img {{ width: 100%; height: 180px; object-fit: cover; border-radius: 16px; margin: 16px 0; }}
    .detail-box {{ background: #f8fafc; border-radius: 16px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0; }}
    .detail-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }}
    .detail-row:last-child {{ margin-bottom: 0; }}
    .qr-container {{ text-align: center; padding: 20px; background: #f1f5f9; border-radius: 20px; margin: 24px 0; border: 2px dashed #cbd5e1; }}
    .qr-img {{ width: 160px; height: 160px; border-radius: 12px; background: white; padding: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
    .btn {{ display: block; text-align: center; padding: 14px 20px; background: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 800; font-size: 13px; border-radius: 14px; margin-top: 12px; }}
    .btn-cal {{ background: #0f172a; margin-top: 8px; }}
    .footer {{ text-align: center; font-size: 11px; color: #94a3b8; padding: 20px 24px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">MOVE<span>CLUB</span></div>
      <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">¡Tu reserva está 100% confirmada!</p>
    </div>
    
    <div class="content">
      <span class="badge">● {category} • {spots} Cupo{'s' if spots > 1 else ''}</span>
      <h2 style="margin: 8px 0 4px 0; font-size: 20px; font-weight: 900; color: #0f172a;">{class_title}</h2>
      <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 600;">{studio_name}</p>
      
      <img src="{studio_image}" alt="{studio_name}" class="hero-img">
      
      <div class="detail-box">
        <div class="detail-row">
          <span style="color: #64748b; font-weight: 600;">📅 Fecha y Hora:</span>
          <span style="font-weight: 800; color: #0f172a;">{start_time} hrs</span>
        </div>
        <div class="detail-row">
          <span style="color: #64748b; font-weight: 600;">📍 Ubicación:</span>
          <span style="font-weight: 700; color: #0f172a;">{address}</span>
        </div>
        <div class="detail-row">
          <span style="color: #64748b; font-weight: 600;">🎟️ Créditos MoveClub:</span>
          <span style="font-weight: 800; color: #4f46e5;">{credits_spent} créditos</span>
        </div>
      </div>
      
      <div class="qr-container">
        <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Tu Pase Digital de Acceso</p>
        <img src="{qr_img_url}" alt="QR Pass" class="qr-img">
        <p style="margin: 10px 0 0 0; font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: 1px;">{qr_code}</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Muestra este código en la recepción del estudio para ingresar.</p>
      </div>

      <a href="{gcal_url}" target="_blank" class="btn btn-cal">
        📅 Agregar a Google Calendar
      </a>
      
      <div style="margin-top: 20px; padding: 12px; border-radius: 12px; background: #fffbeb; border: 1px solid #fef3c7; font-size: 11px; color: #92400e; line-height: 1.4;">
        ⚠️ <strong>Política de Cancelación:</strong> Cancelación gratuita hasta 12 horas antes. Cancelaciones con menos de 12 hrs no reembolsan créditos y aplican cargo de $7.000 CLP.
      </div>
    </div>
    
    <div class="footer">
      MoveClub Chile • Tu membresía fitness y pádel integral.<br>
      ¿Dudas con tu reserva? Escríbenos a soporte@moveclub.cl
    </div>
  </div>
</body>
</html>"""


def generate_reminder_email_html(booking_dict):
    """
    Reminder email template sent 2 hours before class.
    """
    b = booking_dict
    studio_name = b.get("studio_name", "Estudio Asociado")
    class_title = b.get("class_title") or b.get("title", "Clase MoveClub")
    start_time = b.get("start_time", "Hoy")
    address = b.get("studio_address") or b.get("address", "Osorno, Chile")
    qr_code = b.get("qr_code_id") or b.get("qr_code", "MC-PASS-2026")
    qr_img_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={urllib.parse.quote(qr_code)}"

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }}
    .card {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; }}
    .header {{ background: #0f172a; padding: 24px; text-align: center; color: white; }}
    .content {{ padding: 24px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; font-size: 20px;">⏰ ¡Tu clase comienza en 2 horas!</h2>
    </div>
    <div class="content">
      <h3 style="margin: 0 0 6px 0; color: #0f172a;">{class_title}</h3>
      <p style="margin: 0; font-size: 13px; color: #64748b;">{studio_name} • {address}</p>
      <p style="font-size: 14px; font-weight: 800; color: #4f46e5; margin: 12px 0;">🕒 Hora de inicio: {start_time} hrs</p>
      
      <div style="text-align: center; background: #f1f5f9; border-radius: 16px; padding: 16px; margin: 16px 0;">
        <img src="{qr_img_url}" style="width: 140px; height: 140px; border-radius: 8px;">
        <p style="font-weight: 900; margin: 8px 0 0 0; font-size: 13px;">{qr_code}</p>
      </div>
      
      <p style="font-size: 12px; color: #64748b; line-height: 1.4;">
        💡 <strong>Recomendación:</strong> Llega con 10 minutos de anticipación, lleva tu botella de agua y ropa cómoda.
      </p>
    </div>
  </div>
</body>
</html>"""
