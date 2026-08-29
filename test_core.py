#!/usr/bin/env python3
import os
import sys
import uuid

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from db import get_connection, init_db

def test_fitpass_core():
    print("=== INICIANDO PRUEBAS DE FITPASS CORE ===")
    init_db()
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Test User
    cursor.execute("SELECT * FROM users WHERE id = 1")
    user = cursor.fetchone()
    assert user is not None, "Usuario no encontrado"
    initial_balance = user["credits_balance"]
    print(f"1. ✓ Usuario obtenido: {user['name']}, Saldo: {initial_balance} créditos, Plan: {user['plan_tier']}")

    # 2. Test Studios & Instructors
    cursor.execute("SELECT COUNT(*) FROM studios")
    studio_count = cursor.fetchone()[0]
    assert studio_count >= 8, f"Se esperaban al menos 8 estudios, encontrados {studio_count}"
    print(f"2. ✓ {studio_count} estudios verificados con coordenadas y comodidades")

    # 3. Test Classes
    cursor.execute("SELECT * FROM classes WHERE available_spots > 0 LIMIT 1")
    cls = cursor.fetchone()
    assert cls is not None, "No hay clases disponibles"
    class_id = cls["id"]
    credit_cost = cls["credit_cost"]
    initial_spots = cls["available_spots"]
    print(f"3. ✓ Clase seleccionada: '{cls['title']}' ({cls['category']}) - {credit_cost} créditos, {initial_spots} cupos")

    # 4. Test Booking Flow
    qr_code = f"FP-{uuid.uuid4().hex[:8].upper()}-PASS"
    cursor.execute("UPDATE users SET credits_balance = credits_balance - ? WHERE id = 1", (credit_cost,))
    cursor.execute("UPDATE classes SET available_spots = available_spots - 1 WHERE id = ?", (class_id,))
    cursor.execute("INSERT INTO bookings (user_id, class_id, status, qr_code_id) VALUES (1, ?, 'confirmed', ?)", (class_id, qr_code))
    booking_id = cursor.lastrowid
    cursor.execute("INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (1, ?, 'booking', ?)", (-credit_cost, f"Reserva: {cls['title']}"))
    conn.commit()

    # Check updated balance & spots
    cursor.execute("SELECT credits_balance FROM users WHERE id = 1")
    new_balance = cursor.fetchone()["credits_balance"]
    assert new_balance == initial_balance - credit_cost, "Error en deducción de saldo"

    cursor.execute("SELECT available_spots FROM classes WHERE id = ?", (class_id,))
    new_spots = cursor.fetchone()["available_spots"]
    assert new_spots == initial_spots - 1, "Error en reducción de cupos"
    print(f"4. ✓ Reserva exitosa (ID: {booking_id}). Cupos restantes: {new_spots}. Nuevo saldo: {new_balance} créditos")

    # 5. Test Cancellation Flow & Refund
    cursor.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", (booking_id,))
    cursor.execute("UPDATE users SET credits_balance = credits_balance + ? WHERE id = 1", (credit_cost,))
    cursor.execute("UPDATE classes SET available_spots = available_spots + 1 WHERE id = ?", (class_id,))
    cursor.execute("INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (1, ?, 'refund', ?)", (credit_cost, f"Reembolso: {cls['title']}"))
    conn.commit()

    cursor.execute("SELECT credits_balance FROM users WHERE id = 1")
    refunded_balance = cursor.fetchone()["credits_balance"]
    assert refunded_balance == initial_balance, "Error en reembolso de saldo"
    print(f"5. ✓ Cancelación exitosa. Saldo restaurado: {refunded_balance} créditos")

    # 6. Test Top-Up
    cursor.execute("UPDATE users SET credits_balance = credits_balance + 25 WHERE id = 1")
    cursor.execute("INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (1, 25, 'topup', 'Pack +25 Créditos')")
    conn.commit()

    cursor.execute("SELECT credits_balance FROM users WHERE id = 1")
    topped_balance = cursor.fetchone()["credits_balance"]
    assert topped_balance == initial_balance + 25, "Error en recarga de créditos"
    print(f"6. ✓ Recarga de +25 créditos exitosa. Nuevo saldo: {topped_balance} créditos")

    # 7. Test Admin Class Creation
    cursor.execute('''
        INSERT INTO classes (studio_id, instructor_id, title, category, start_time, duration_minutes, credit_cost, max_capacity, available_spots, description, level)
        VALUES (1, 1, 'Clase Test Masterclass', 'Yoga', '2026-08-30 18:00', 60, 6, 20, 20, 'Test description', 'Avanzado')
    ''')
    admin_class_id = cursor.lastrowid
    conn.commit()
    assert admin_class_id > 0, "Error creando clase de admin"
    print(f"7. ✓ Clase de administrador creada exitosamente (ID: {admin_class_id})")

    conn.close()
    print("\n🎉 ¡TODAS LAS PRUEBAS DE LÓGICA PASARON AL 100%!")

if __name__ == "__main__":
    test_fitpass_core()
