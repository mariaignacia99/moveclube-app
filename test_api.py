#!/usr/bin/env python3
import urllib.request
import urllib.error
import json
import time
import subprocess
import os
import sys

def run_tests():
    # Start server in background
    server_dir = "/Users/nachasanchezhenriquez/.gemini/antigravity/scratch/fitpass-app"
    proc = subprocess.Popen([sys.executable, "backend/server.py"], cwd=server_dir)
    time.sleep(1)

    base_url = "http://localhost:8000"

    try:
        # Test 1: GET /api/user
        print("1. Probando GET /api/user...")
        req = urllib.request.urlopen(f"{base_url}/api/user")
        data = json.loads(req.read().decode())
        assert data["success"] == True
        initial_balance = data["user"]["credits_balance"]
        print(f"   ✓ Usuario: {data['user']['name']}, Saldo: {initial_balance} créditos")

        # Test 2: GET /api/categories
        print("2. Probando GET /api/categories...")
        req = urllib.request.urlopen(f"{base_url}/api/categories")
        data = json.loads(req.read().decode())
        assert data["success"] == True and len(data["categories"]) > 0
        print(f"   ✓ {len(data['categories'])} categorías disponibles")

        # Test 3: GET /api/classes
        print("3. Probando GET /api/classes...")
        req = urllib.request.urlopen(f"{base_url}/api/classes")
        data = json.loads(req.read().decode())
        assert data["success"] == True and len(data["classes"]) > 0
        target_class = data["classes"][1]
        print(f"   ✓ {len(data['classes'])} clases disponibles. Clase objetivo: '{target_class['title']}' ({target_class['credit_cost']} cr)")

        # Test 4: POST /api/bookings (Reservar clase)
        print("4. Probando POST /api/bookings...")
        payload = json.dumps({"class_id": target_class["id"]}).encode("utf-8")
        req = urllib.request.Request(f"{base_url}/api/bookings", data=payload, headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req)
        book_data = json.loads(resp.read().decode())
        assert book_data["success"] == True
        booking_id = book_data["booking_id"]
        assert book_data["new_balance"] == initial_balance - target_class["credit_cost"]
        print(f"   ✓ Reserva creada con éxito ID {booking_id}. Pase QR: {book_data['qr_code']}. Nuevo saldo: {book_data['new_balance']} cr")

        # Test 5: POST /api/bookings/:id/cancel (Cancelar y reembolsar)
        print("5. Probando POST /api/bookings/<id>/cancel...")
        req = urllib.request.Request(f"{base_url}/api/bookings/{booking_id}/cancel", data=b"{}", headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req)
        cancel_data = json.loads(resp.read().decode())
        assert cancel_data["success"] == True
        assert cancel_data["new_balance"] == initial_balance
        print(f"   ✓ Reserva cancelada y créditos reembolsados. Saldo restaurado: {cancel_data['new_balance']} cr")

        # Test 6: POST /api/user/topup (Comprar créditos)
        print("6. Probando POST /api/user/topup...")
        payload = json.dumps({"credits": 10, "description": "Pack Test +10"}).encode("utf-8")
        req = urllib.request.Request(f"{base_url}/api/user/topup", data=payload, headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req)
        topup_data = json.loads(resp.read().decode())
        assert topup_data["success"] == True
        assert topup_data["new_balance"] == initial_balance + 10
        print(f"   ✓ Recarga exitosa. Nuevo saldo: {topup_data['new_balance']} cr")

        # Test 7: GET / (Frontend HTML)
        print("7. Probando carga de frontend / ...")
        req = urllib.request.urlopen(f"{base_url}/")
        html = req.read().decode()
        assert "FitPass" in html
        print("   ✓ Frontend index.html cargado correctamente")

        print("\n🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!")

    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    run_tests()
