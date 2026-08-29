# FitPass ⚡ (ClassPass Clone)

Aplicación web completa e interactiva inspirada en **ClassPass**. Permite descubrir estudios de fitness, reservar clases con un sistema de créditos, visualizar estudios en un mapa interactivo, generar pases digitales QR para check-in y gestionar membresías.

---

## 🌟 Características Principales

1. **Exploración Inteligente y Filtros en Tiempo Real**:
   - Búsqueda por nombre de clase, estudio, instructor o barrio.
   - Carrusel de fechas dinámico (Hoy, Mañana, Días de la semana).
   - Filtros por disciplina: **Yoga, Spinning, CrossFit, Pilates, Boxeo, Spa & Bienestar, HIIT, Natación**.
   - Filtros por horario (Mañana, Tarde, Noche) y costo máximo en créditos.

2. **Mapa Interactivo con Geolocalización**:
   - Vista en mapa Leaflet con pines de estudios asociados en Santiago.
   - Popups con información del estudio, calificación y acceso directo a sus horarios.

3. **Motor de Reservas y Créditos**:
   - Reserva en un clic con deducción instantánea de créditos y control de cupos.
   - Indicador de escasez de cupos (`🔥 ¡Solo 2 cupos!`).
   - Política de cancelación con reembolso automático de créditos.

4. **Pase Digital de Acceso (QR Check-In)**:
   - Generación instantánea de códigos QR para presentar en recepción del estudio.

5. **Tienda y Gestión de Membresías**:
   - Visualización de saldo y equivalencia estimada en clases.
   - Planes mensuales: Básico (25 cr), Pro (50 cr) y Elite (100 cr).
   - Paquetes de recarga rápida (+10 cr, +25 cr).
   - Historial de transacciones de créditos.

6. **Estudios Favoritos y Calificaciones**:
   - Marcado de favoritos con 1 clic.
   - Sistema de calificación de 1 a 5 estrellas y reseñas tras asistir a clases.

7. **Portal de Estudios (Partner / Admin Mode)**:
   - Publicación de nuevas clases con horario, instructor, créditos y capacidad máxima.

---

## 🚀 Cómo Ejecutar

Solo requieres Python 3 (incluido en macOS). No requiere instalar librerías externas.

```bash
# Opción 1: Usando el script
./start.sh

# Opción 2: Directamente con Python
python3 backend/server.py
```

Luego abre tu navegador en:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 📁 Estructura del Proyecto

```
fitpass-app/
├── backend/
│   ├── db.py            # Esquema SQLite y sembrado de datos iniciales
│   ├── server.py        # API REST modular y servidor de archivos estáticos
│   └── fitpass.db       # Base de datos SQLite
├── frontend/
│   ├── index.html       # Interfaz de usuario SPA moderna y responsiva
│   ├── css/
│   │   └── styles.css   # Estilos personalizados y animaciones
│   └── js/
│       └── app.js       # Lógica del cliente, API REST, mapas y QR
├── start.sh             # Script de inicio rápido
└── README.md            # Documentación
```
