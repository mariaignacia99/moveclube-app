#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import urllib.parse
import uuid
from datetime import datetime
from db import get_connection, init_db

PORT = int(os.environ.get("PORT", 8000))
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

class FitPassRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def _send_json(self, data, status=200):
        response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def _parse_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Static assets routing
        if not path.startswith("/api/"):
            return super().do_GET()

        try:
            # 1. GET /api/user
            if path == "/api/user":
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users LIMIT 1")
                user = dict(cursor.fetchone())
                
                # Fetch recent transactions
                cursor.execute('''
                    SELECT * FROM credit_transactions 
                    WHERE user_id = ? 
                    ORDER BY created_at DESC LIMIT 10
                ''', (user["id"],))
                user["transactions"] = [dict(r) for r in cursor.fetchall()]
                conn.close()
                return self._send_json({"success": True, "user": user})

            # 2. GET /api/categories
            elif path == "/api/categories":
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT category, COUNT(DISTINCT studio_id) as studios_count, COUNT(*) as classes_count
                    FROM classes
                    GROUP BY category
                    ORDER BY classes_count DESC
                ''')
                categories = [dict(r) for r in cursor.fetchall()]
                conn.close()
                return self._send_json({"success": True, "categories": categories})

            # 3. GET /api/studios
            elif path == "/api/studios":
                city = query.get("city", [None])[0]
                category = query.get("category", [None])[0]
                search = query.get("search", [None])[0]

                conn = get_connection()
                cursor = conn.cursor()
                sql = "SELECT * FROM studios WHERE 1=1"
                params = []

                if city and city != "all" and city != "Todas":
                    sql += " AND city = ?"
                    params.append(city)

                if category and category != "all" and category != "Todos":
                    sql += " AND category = ?"
                    params.append(category)

                if search:
                    sql += " AND (name LIKE ? OR neighborhood LIKE ? OR description LIKE ? OR city LIKE ?)"
                    term = f"%{search}%"
                    params.extend([term, term, term, term])

                sql += " ORDER BY rating DESC"
                cursor.execute(sql, params)
                studios = [dict(r) for r in cursor.fetchall()]

                # Add favorite status for user 1
                cursor.execute("SELECT studio_id FROM favorites WHERE user_id = 1")
                fav_set = {r["studio_id"] for r in cursor.fetchall()}
                for s in studios:
                    s["is_favorite"] = s["id"] in fav_set

                conn.close()
                return self._send_json({"success": True, "studios": studios})

            # 4. GET /api/studios/<id>
            elif path.startswith("/api/studios/"):
                studio_id = int(path.split("/")[-1])
                conn = get_connection()
                cursor = conn.cursor()
                
                cursor.execute("SELECT * FROM studios WHERE id = ?", (studio_id,))
                row = cursor.fetchone()
                if not row:
                    conn.close()
                    return self._send_json({"error": "Estudio no encontrado"}, 404)
                studio = dict(row)

                # Check if favorite
                cursor.execute("SELECT 1 FROM favorites WHERE user_id = 1 AND studio_id = ?", (studio_id,))
                studio["is_favorite"] = cursor.fetchone() is not None

                # Instructors
                cursor.execute("SELECT * FROM instructors WHERE studio_id = ?", (studio_id,))
                studio["instructors"] = [dict(r) for r in cursor.fetchall()]

                # Upcoming classes
                cursor.execute('''
                    SELECT c.*, i.name as instructor_name, i.avatar_url as instructor_avatar
                    FROM classes c
                    JOIN instructors i ON c.instructor_id = i.id
                    WHERE c.studio_id = ?
                    ORDER BY c.start_time ASC
                ''', (studio_id,))
                studio["classes"] = [dict(r) for r in cursor.fetchall()]

                conn.close()
                return self._send_json({"success": True, "studio": studio})

            # 5. GET /api/classes
            elif path == "/api/classes":
                city_filter = query.get("city", [None])[0]
                date_filter = query.get("date", [None])[0]
                category = query.get("category", [None])[0]
                time_of_day = query.get("time_of_day", [None])[0] # morning, afternoon, evening
                max_credits = query.get("max_credits", [None])[0]
                search = query.get("search", [None])[0]

                conn = get_connection()
                cursor = conn.cursor()

                sql = '''
                    SELECT c.*, 
                           s.name as studio_name, s.neighborhood, s.city, s.address, s.image_url as studio_image, s.rating as studio_rating,
                           i.name as instructor_name, i.avatar_url as instructor_avatar
                    FROM classes c
                    JOIN studios s ON c.studio_id = s.id
                    JOIN instructors i ON c.instructor_id = i.id
                    WHERE 1=1
                '''
                params = []

                if city_filter and city_filter != "all" and city_filter != "Todas":
                    sql += " AND s.city = ?"
                    params.append(city_filter)

                if date_filter:
                    sql += " AND c.start_time LIKE ?"
                    params.append(f"{date_filter}%")

                if category and category != "all" and category != "Todos":
                    sql += " AND c.category = ?"
                    params.append(category)

                if max_credits:
                    sql += " AND c.credit_cost <= ?"
                    params.append(int(max_credits))

                if search:
                    sql += " AND (c.title LIKE ? OR s.name LIKE ? OR i.name LIKE ? OR s.neighborhood LIKE ? OR s.city LIKE ?)"
                    term = f"%{search}%"
                    params.extend([term, term, term, term, term])

                sql += " ORDER BY c.start_time ASC"
                cursor.execute(sql, params)
                classes = [dict(r) for r in cursor.fetchall()]

                # Filter time of day if requested
                if time_of_day and time_of_day != "all":
                    filtered = []
                    for c in classes:
                        hour = int(c["start_time"].split(" ")[1].split(":")[0])
                        if time_of_day == "morning" and hour < 12:
                            filtered.append(c)
                        elif time_of_day == "afternoon" and 12 <= hour < 18:
                            filtered.append(c)
                        elif time_of_day == "evening" and hour >= 18:
                            filtered.append(c)
                    classes = filtered

                conn.close()
                return self._send_json({"success": True, "classes": classes})

            # 6. GET /api/bookings
            elif path == "/api/bookings":
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT b.id as booking_id, b.status, b.booked_at, b.qr_code_id, b.rating, b.review_comment,
                           c.id as class_id, c.title as class_title, c.category, c.start_time, c.duration_minutes, c.credit_cost,
                           s.id as studio_id, s.name as studio_name, s.address as studio_address, s.neighborhood, s.image_url as studio_image,
                           i.name as instructor_name, i.avatar_url as instructor_avatar
                    FROM bookings b
                    JOIN classes c ON b.class_id = c.id
                    JOIN studios s ON c.studio_id = s.id
                    JOIN instructors i ON c.instructor_id = i.id
                    WHERE b.user_id = 1
                    ORDER BY c.start_time DESC
                ''')
                bookings = [dict(r) for r in cursor.fetchall()]
                conn.close()
                return self._send_json({"success": True, "bookings": bookings})

            # 7. GET /api/favorites
            elif path == "/api/favorites":
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT s.* 
                    FROM favorites f
                    JOIN studios s ON f.studio_id = s.id
                    WHERE f.user_id = 1
                    ORDER BY s.rating DESC
                ''')
                studios = [dict(r) for r in cursor.fetchall()]
                for s in studios:
                    s["is_favorite"] = True
                conn.close()
                return self._send_json({"success": True, "favorites": studios})

            else:
                return self._send_json({"error": "Endpoint no encontrado"}, 404)

        except Exception as e:
            return self._send_json({"error": str(e)}, 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._parse_body()

        try:
            # 1. POST /api/bookings - Make a new reservation
            if path == "/api/bookings":
                class_id = body.get("class_id")
                if not class_id:
                    return self._send_json({"error": "Se requiere class_id"}, 400)

                conn = get_connection()
                cursor = conn.cursor()

                # Get class info
                cursor.execute("SELECT * FROM classes WHERE id = ?", (class_id,))
                cls = cursor.fetchone()
                if not cls:
                    conn.close()
                    return self._send_json({"error": "Clase no encontrada"}, 404)

                if cls["available_spots"] <= 0:
                    conn.close()
                    return self._send_json({"error": "No quedan cupos disponibles para esta clase"}, 400)

                # Get user balance
                cursor.execute("SELECT * FROM users WHERE id = 1")
                user = cursor.fetchone()

                if user["credits_balance"] < cls["credit_cost"]:
                    conn.close()
                    return self._send_json({
                        "error": f"Créditos insuficientes. Necesitas {cls['credit_cost']} créditos y tienes {user['credits_balance']}."
                    }, 400)

                # Check if already booked
                cursor.execute('''
                    SELECT id FROM bookings 
                    WHERE user_id = 1 AND class_id = ? AND status = 'confirmed'
                ''', (class_id,))
                if cursor.fetchone():
                    conn.close()
                    return self._send_json({"error": "Ya tienes una reserva activa para esta clase"}, 400)

                # Generate QR Pass code
                qr_code = f"FP-{uuid.uuid4().hex[:8].upper()}-PASS"

                # Deduct credits
                new_balance = user["credits_balance"] - cls["credit_cost"]
                cursor.execute("UPDATE users SET credits_balance = ? WHERE id = 1", (new_balance,))

                # Decrement spots
                cursor.execute("UPDATE classes SET available_spots = available_spots - 1 WHERE id = ?", (class_id,))

                # Insert booking
                cursor.execute('''
                    INSERT INTO bookings (user_id, class_id, status, qr_code_id)
                    VALUES (1, ?, 'confirmed', ?)
                ''', (class_id, qr_code))
                booking_id = cursor.lastrowid

                # Record transaction
                cursor.execute('''
                    INSERT INTO credit_transactions (user_id, amount, type, description)
                    VALUES (1, ?, 'booking', ?)
                ''', (-cls["credit_cost"], f"Reserva: {cls['title']}"))

                conn.commit()
                conn.close()

                return self._send_json({
                    "success": True,
                    "message": "¡Reserva confirmada con éxito!",
                    "booking_id": booking_id,
                    "qr_code": qr_code,
                    "new_balance": new_balance
                })

            # 2. POST /api/bookings/<id>/cancel - Cancel reservation with credit refund
            elif path.startswith("/api/bookings/") and path.endswith("/cancel"):
                booking_id = int(path.split("/")[3])
                conn = get_connection()
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT b.*, c.credit_cost, c.title, c.id as class_id
                    FROM bookings b
                    JOIN classes c ON b.class_id = c.id
                    WHERE b.id = ? AND b.user_id = 1
                ''', (booking_id,))
                booking = cursor.fetchone()

                if not booking:
                    conn.close()
                    return self._send_json({"error": "Reserva no encontrada"}, 404)

                if booking["status"] == "cancelled":
                    conn.close()
                    return self._send_json({"error": "Esta reserva ya fue cancelada"}, 400)

                # Update booking status
                cursor.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", (booking_id,))

                # Refund credits to user
                cursor.execute("UPDATE users SET credits_balance = credits_balance + ? WHERE id = 1", (booking["credit_cost"],))
                
                # Restore spot in class
                cursor.execute("UPDATE classes SET available_spots = available_spots + 1 WHERE id = ?", (booking["class_id"],))

                # Record refund transaction
                cursor.execute('''
                    INSERT INTO credit_transactions (user_id, amount, type, description)
                    VALUES (1, ?, 'refund', ?)
                ''', (booking["credit_cost"], f"Reembolso por cancelación: {booking['title']}"))

                # Get updated balance
                cursor.execute("SELECT credits_balance FROM users WHERE id = 1")
                new_balance = cursor.fetchone()["credits_balance"]

                conn.commit()
                conn.close()

                return self._send_json({
                    "success": True,
                    "message": f"Reserva cancelada. Se han reembolsado {booking['credit_cost']} créditos a tu cuenta.",
                    "new_balance": new_balance
                })

            # 3. POST /api/bookings/<id>/review - Submit rating/review
            elif path.startswith("/api/bookings/") and path.endswith("/review"):
                booking_id = int(path.split("/")[3])
                rating = int(body.get("rating", 5))
                comment = body.get("comment", "")

                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE bookings 
                    SET rating = ?, review_comment = ?
                    WHERE id = ? AND user_id = 1
                ''', (rating, comment, booking_id))
                conn.commit()
                conn.close()

                return self._send_json({"success": True, "message": "¡Gracias por calificar tu clase!"})

            # 4. POST /api/user/topup - Purchase credits or switch plan
            elif path == "/api/user/topup":
                credits_to_add = int(body.get("credits", 0))
                plan_tier = body.get("plan_tier")
                description = body.get("description", f"Recarga de +{credits_to_add} créditos")

                if credits_to_add <= 0:
                    return self._send_json({"error": "Cantidad de créditos no válida"}, 400)

                conn = get_connection()
                cursor = conn.cursor()

                if plan_tier:
                    cursor.execute('''
                        UPDATE users 
                        SET credits_balance = credits_balance + ?, plan_tier = ?
                        WHERE id = 1
                    ''', (credits_to_add, plan_tier))
                else:
                    cursor.execute('''
                        UPDATE users 
                        SET credits_balance = credits_balance + ?
                        WHERE id = 1
                    ''', (credits_to_add,))

                # Record transaction
                cursor.execute('''
                    INSERT INTO credit_transactions (user_id, amount, type, description)
                    VALUES (1, ?, 'topup', ?)
                ''', (credits_to_add, description))

                cursor.execute("SELECT credits_balance, plan_tier FROM users WHERE id = 1")
                user = cursor.fetchone()

                conn.commit()
                conn.close()

                return self._send_json({
                    "success": True,
                    "message": f"¡Compra exitosa! Se han agregado {credits_to_add} créditos a tu cuenta.",
                    "new_balance": user["credits_balance"],
                    "plan_tier": user["plan_tier"]
                })

            # 4.1 POST /api/payments/checkout - Iniciar orden de pasarela de pago (Webpay / Fintoc / Mercado Pago)
            elif path == "/api/payments/checkout":
                plan_name = body.get("plan_name", "Plan Pro MoveClub")
                credits = int(body.get("credits", 50))
                amount_clp = int(body.get("amount_clp", 39900))
                method = body.get("method", "webpay") # webpay, fintoc, mercadopago, card

                order_id = f"MC-ORD-{uuid.uuid4().hex[:8].upper()}-CLP"
                auth_code = f"AUTH-{uuid.uuid4().hex[:6].upper()}"

                return self._send_json({
                    "success": True,
                    "order_id": order_id,
                    "auth_code": auth_code,
                    "plan_name": plan_name,
                    "credits": credits,
                    "amount_clp": amount_clp,
                    "method": method,
                    "currency": "CLP",
                    "status": "ready_for_payment"
                })

            # 4.2 POST /api/payments/confirm - Webhook / Confirmación de pago exitoso
            elif path == "/api/payments/confirm":
                order_id = body.get("order_id", f"MC-ORD-{uuid.uuid4().hex[:8].upper()}")
                auth_code = body.get("auth_code", f"AUTH-{uuid.uuid4().hex[:6].upper()}")
                plan_name = body.get("plan_name", "Plan Pro (50 créditos/mes)")
                credits_to_add = int(body.get("credits", 50))
                amount_clp = int(body.get("amount_clp", 39900))
                method = body.get("method", "Transbank Webpay Plus")

                conn = get_connection()
                cursor = conn.cursor()

                # Update credits and plan
                if "Plan" in plan_name:
                    cursor.execute('''
                        UPDATE users 
                        SET credits_balance = credits_balance + ?, plan_tier = ?
                        WHERE id = 1
                    ''', (credits_to_add, plan_name))
                else:
                    cursor.execute('''
                        UPDATE users 
                        SET credits_balance = credits_balance + ?
                        WHERE id = 1
                    ''', (credits_to_add,))

                # Record transaction
                desc = f"Pago {method} ({order_id}): {plan_name} (${amount_clp:,} CLP)".replace(",", ".")
                cursor.execute('''
                    INSERT INTO credit_transactions (user_id, amount, type, description)
                    VALUES (1, ?, 'subscription' if ? in plan_name else 'topup', ?)
                ''', (credits_to_add, "Plan", desc))

                cursor.execute("SELECT credits_balance, plan_tier FROM users WHERE id = 1")
                user = cursor.fetchone()

                conn.commit()
                conn.close()

                return self._send_json({
                    "success": True,
                    "message": f"¡Pago de ${amount_clp:,} CLP procesado con éxito vía {method}!".replace(",", "."),
                    "receipt": {
                        "order_id": order_id,
                        "auth_code": auth_code,
                        "method": method,
                        "amount_clp": amount_clp,
                        "credits_added": credits_to_add,
                        "plan_name": plan_name,
                        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    },
                    "new_balance": user["credits_balance"],
                    "plan_tier": user["plan_tier"]
                })

            # 5. POST /api/user/register_trial (Registro de Cliente + Enlace de Tarjeta para Prueba Gratuita 7 Días)
            elif path == "/api/user/register_trial":
                name = body.get("name", "María Ignacia Sánchez")
                email = body.get("email", "sanchezhenriquezmariaignacia99@gmail.com")
                phone = body.get("phone", "+56 9 8765 4321")
                city = body.get("city", "Osorno")
                card_number = body.get("card_number", "4532 8912 3456 7890")
                card_holder = body.get("card_holder", name)
                card_expiry = body.get("card_expiry", "12/28")

                digits_only = "".join(filter(str.isdigit, str(card_number)))
                card_last4 = digits_only[-4:] if len(digits_only) >= 4 else "4242"
                card_brand = "Visa" if str(card_number).startswith("4") else "Mastercard"

                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE users 
                    SET name = ?,
                        email = ?,
                        phone = ?,
                        city = ?,
                        credits_balance = 10,
                        plan_tier = 'Prueba Gratuita (10 créditos / 7 días)',
                        card_last4 = ?,
                        card_brand = ?,
                        card_holder = ?,
                        card_expiry = ?,
                        trial_ends_at = datetime('now', '+7 days')
                    WHERE id = 1
                ''', (name, email, phone, city, card_last4, card_brand, card_holder, card_expiry))

                cursor.execute('''
                    INSERT INTO credit_transactions (user_id, amount, type, description)
                    VALUES (1, 10, 'topup', ?)
                ''', (f"💳 Activación Prueba 7 Días: Tarjeta {card_brand} •••• {card_last4} enlazada (10 créditos)",))

                conn.commit()
                conn.close()
                return self._send_json({
                    "success": True, 
                    "message": f"💳 ¡Tarjeta {card_brand} •••• {card_last4} enlazada con éxito! Tus 10 créditos gratis están listos.",
                    "new_balance": 10,
                    "plan_tier": "Prueba Gratuita (10 créditos / 7 días)",
                    "card_last4": card_last4,
                    "card_brand": card_brand
                })

            # POST /api/user/reset_fresh (Empezar de cero sin usuario ni tarjeta)
            elif path == "/api/user/reset_fresh":
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE users 
                    SET name = 'Nuevo Usuario',
                        email = 'nuevo@moveclub.cl',
                        phone = '',
                        city = 'Osorno',
                        credits_balance = 0, 
                        plan_tier = 'Sin Plan Activo',
                        card_last4 = NULL,
                        card_brand = NULL,
                        card_holder = NULL,
                        card_expiry = NULL,
                        trial_ends_at = NULL
                    WHERE id = 1
                ''')
                cursor.execute('DELETE FROM bookings WHERE user_id = 1')
                cursor.execute('DELETE FROM credit_transactions WHERE user_id = 1')
                cursor.execute('DELETE FROM favorites WHERE user_id = 1')
                conn.commit()
                conn.close()
                return self._send_json({
                    "success": True, 
                    "message": "🔄 Usuario restablecido de cero. ¡Listo para probar el registro!",
                    "new_balance": 0,
                    "plan_tier": "Sin Plan Activo"
                })

            # POST /api/user/reset_trial
            elif path == "/api/user/reset_trial":
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE users 
                    SET name = 'María Ignacia Sánchez',
                        email = 'sanchezhenriquezmariaignacia99@gmail.com',
                        credits_balance = 10, 
                        plan_tier = 'Prueba Gratuita (10 créditos / 7 días)'
                    WHERE id = 1
                ''')
                cursor.execute('''
                    INSERT INTO credit_transactions (user_id, amount, type, description)
                    VALUES (1, 10, 'topup', '🎁 Bono de Bienvenida MoveClub: 10 Créditos Gratis (Prueba 7 Días - 2 Clases)')
                ''')
                conn.commit()
                conn.close()
                return self._send_json({
                    "success": True, 
                    "message": "🎁 ¡10 Créditos Gratis de Prueba activados (Válidos por 7 días para 2 clases)!",
                    "new_balance": 10,
                    "plan_tier": "Prueba Gratuita (10 créditos / 7 días)"
                })

            # 6. POST /api/favorites/toggle
            elif path == "/api/favorites/toggle":
                studio_id = body.get("studio_id")
                if not studio_id:
                    return self._send_json({"error": "studio_id requerido"}, 400)

                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM favorites WHERE user_id = 1 AND studio_id = ?", (studio_id,))
                fav = cursor.fetchone()

                if fav:
                    cursor.execute("DELETE FROM favorites WHERE id = ?", (fav["id"],))
                    is_fav = False
                    msg = "Estudio eliminado de favoritos"
                else:
                    cursor.execute("INSERT INTO favorites (user_id, studio_id) VALUES (1, ?)", (studio_id,))
                    is_fav = True
                    msg = "Estudio agregado a favoritos"

                conn.commit()
                conn.close()

                return self._send_json({"success": True, "is_favorite": is_fav, "message": msg})

            # 6. POST /api/admin/classes - Add new class
            elif path == "/api/admin/classes":
                studio_id = body.get("studio_id")
                title = body.get("title")
                category = body.get("category", "Fitness")
                start_time = body.get("start_time")
                duration = int(body.get("duration_minutes", 50))
                credits = int(body.get("credit_cost", 5))
                capacity = int(body.get("max_capacity", 15))
                desc = body.get("description", "")
                level = body.get("level", "Todos los niveles")

                conn = get_connection()
                cursor = conn.cursor()

                # Get or create default instructor for this studio
                cursor.execute("SELECT id FROM instructors WHERE studio_id = ? LIMIT 1", (studio_id,))
                inst = cursor.fetchone()
                instructor_id = inst["id"] if inst else 1

                cursor.execute('''
                    INSERT INTO classes (studio_id, instructor_id, title, category, start_time, duration_minutes, credit_cost, max_capacity, available_spots, description, level)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (studio_id, instructor_id, title, category, start_time, duration, credits, capacity, capacity, desc, level))

                class_id = cursor.lastrowid
                conn.commit()
                conn.close()

                return self._send_json({
                    "success": True,
                    "message": "Nueva clase publicada con éxito",
                    "class_id": class_id
                })

            else:
                return self._send_json({"error": "Endpoint no encontrado"}, 404)

        except Exception as e:
            return self._send_json({"error": str(e)}, 500)

def run_server():
    init_db()
    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), FitPassRequestHandler) as httpd:
        print(f"🚀 MoveClub Server ejecutándose en http://localhost:{PORT}")
        print(f"📁 Sirviendo frontend desde: {FRONTEND_DIR}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDeteniendo servidor...")
            httpd.server_close()

if __name__ == "__main__":
    run_server()
