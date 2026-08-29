# 🤖 PAQUETE OFICIAL DE PUBLICACIÓN EN GOOGLE PLAY STORE (ANDROID) - MOVECLUB

Este documento contiene **todos los datos, textos, configuraciones y activos listos para copiar y pegar** en la consola de desarrollador de Google Play (**Google Play Console**) para publicar **MoveClub** en Android.

---

## 📋 1. FICHA TÉCNICA DE LA APLICACIÓN

* **Nombre de la App:** MoveClub
* **Package Name (ID de paquete):** `com.mariaignacia.moveclub`
* **Versión:** `1.0.0` (VersionCode: `1`)
* **Categoría principal:** Salud y bienestar / Deportes (Health & Fitness / Sports)
* **Público objetivo:** Mayores de 13 años (Todo público)
* **Ubicación inicial:** Chile (Osorno y Temuco)
* **URL de Política de Privacidad:** `https://moveclube-app.onrender.com/privacy.html`
* **Correo de soporte:** `contacto@moveclub.cl` o `sanchezhenriquezmariaignacia99@gmail.com`

---

## 📝 2. TEXTOS LISTOS PARA LA FICHA DE GOOGLE PLAY (COPY & PASTE)

### A. Título de la Aplicación (Máx. 30 caracteres):
```text
MoveClub - Pádel, Gym y Clases
```

### B. Descripción Corta (Máx. 80 caracteres):
```text
Entrena pádel, pilates, gym y yoga con 1 sola membresía en Osorno y Temuco.
```

### C. Descripción Completa (Formateada para Google Play):
```text
¡Bienvenido a MoveClub! La membresía deportiva flexible que te conecta con los mejores estudios de fitness, clubes de pádel, centros de pilates reformer, box de crossfit, yoga y spas en Osorno y Temuco con una sola cuenta.

🎾 ¿QUÉ ES MOVECLUB?
MoveClub te da acceso ilimitado a cientos de clases semanales sin amarrarte a un solo gimnasio ni contratos a largo plazo. Compra créditos mensuales o canjea tus clases cuando y donde quieras.

✨ DISCIPLINAS DISPONIBLES EN OSORNO Y TEMUCO:
• 🎾 Pádel: Clínicas técnicas, partidos nivelados y arriendo de canchas techadas.
• 🧘‍♀️ Pilates Reformer & Mat: Tonificación, postura y control corporal.
• 🏋️ CrossFit & Funcional: Fuerza, HIIT y alta intensidad.
• 🧘 Yoga & Movilidad: Vinyasa, Hatha y flexibilidad.
• 🥊 Boxeo & Kickboxing: Cardio, técnica y sacos Aqua Bag.
• 🧖‍♀️ Spas & Bienestar: Saunas, masajes deportivos y recuperación kine.

🎁 PRUEBA GRATIS DE 7 DÍAS:
Activa tu cuenta hoy y recibe 10 créditos de regalo para reservar tus 2 primeras clases 100% gratis en los mejores centros de tu ciudad.

💎 PLANES MENSUALES FLEXIBLES:
• Plan Básico (26 créditos/mes): Para mantenerte activo (5-6 clases).
• Plan Standard (34 créditos/mes): Tu rutina semanal (7-8 clases).
• Plan Pro (45 créditos/mes): ¡El más popular! (10-11 clases).
• Plan Elite (60 créditos/mes): Alto rendimiento y bienestar integral.

📲 CÓMO FUNCIONA:
1. Explora estudios cercanos en el mapa interactivo o busca por tu deporte favorito.
2. Filtra por horario, instructor o costo en créditos (<4, <6, <10 créditos).
3. Reserva tu cupo en 1 segundo y recibe tu Pase Digital con Código QR.
4. Llega al local, muestra tu QR en recepción y ¡a entrenar!

👥 PROGRAMA DE REFERIDOS:
Invita a tus amigos a MoveClub. Por cada amigo que se suscriba te llevas 20 créditos de regalo. ¡Y si invitas a 3 amigos te damos un total de 100 créditos para entrenar gratis!

Únete a la comunidad de deportistas más activa del sur de Chile. 

MoveClub: Entrena. Conecta. Supérate.
```

---

## 🎨 3. ACTIVOS GRÁFICOS GENERADOS Y LISTOS

Los archivos gráficos oficiales se encuentran en la carpeta `/android`:
1. **Icono de la App para Google Play (512x512 PNG):**
   * Ubicación: `android/playstore_icon_512.png`
2. **Gráfico de Funciones / Feature Graphic (1024x500 PNG):**
   * Ubicación: `android/playstore_feature_graphic_1024x500.png`
3. **Iconos de Lanzador (Android Mipmaps):**
   * Ubicaciones: `android/app/src/main/res/mipmap-*` (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi).

---

## 🚀 4. PASO A PASO PARA SUBIRLO A GOOGLE PLAY CONSOLE

1. **Crear tu Cuenta de Desarrollador Google Play:**
   * Entra a [https://play.google.com/console/signup](https://play.google.com/console/signup).
   * Inicia sesión con tu cuenta de Google (`sanchezhenriquezmariaignacia99@gmail.com`).
   * Paga la tarifa única de registro de Google ($25 USD para toda la vida).
2. **Crear la Aplicación en la Consola:**
   * Clic en **"Crear aplicación"**.
   * Nombre: `MoveClub`.
   * Idioma predeterminado: `Español (Chile)`.
   * Tipo: `Aplicación` / `Gratis`.
3. **Completar la Ficha de Play Store:**
   * Pega el Título, Descripción Corta y Descripción Completa de la Sección 2 de este documento.
   * Sube el icono (`playstore_icon_512.png`) y el banner (`playstore_feature_graphic_1024x500.png`).
   * Pega la URL de Política de Privacidad: `https://moveclube-app.onrender.com/privacy.html`.
4. **Subir el Paquete (`.aab` / App Bundle):**
   * Ve a **Producción** $	o$ **Crear nueva versión**.
   * Sube el archivo `app-release.aab` generado del proyecto `android/`.
   * Clic en **Guardar y Enviar a Revisión**.