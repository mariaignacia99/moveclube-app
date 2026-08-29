#!/usr/bin/env python3
import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fitpass.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force_reseed=False):
    if force_reseed and os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    conn = get_connection()
    cursor = conn.cursor()

    # Create tables
    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        credits_balance INTEGER DEFAULT 45,
        plan_tier TEXT DEFAULT 'Pro (50 créditos/mes)',
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS studios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        tagline TEXT,
        description TEXT,
        address TEXT NOT NULL,
        city TEXT NOT NULL, -- 'Osorno', 'Temuco', 'Santiago', 'Puerto Varas'
        neighborhood TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        image_url TEXT NOT NULL,
        rating REAL DEFAULT 4.9,
        review_count INTEGER DEFAULT 120,
        amenities TEXT NOT NULL, -- Comma-separated
        phone TEXT,
        website TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS instructors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studio_id INTEGER,
        name TEXT NOT NULL,
        bio TEXT,
        avatar_url TEXT NOT NULL,
        specialty TEXT,
        FOREIGN KEY (studio_id) REFERENCES studios (id)
    );

    CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studio_id INTEGER NOT NULL,
        instructor_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        start_time TEXT NOT NULL, -- ISO Format YYYY-MM-DD HH:MM
        duration_minutes INTEGER DEFAULT 50,
        credit_cost INTEGER NOT NULL,
        max_capacity INTEGER DEFAULT 16,
        available_spots INTEGER DEFAULT 12,
        description TEXT,
        level TEXT DEFAULT 'Todos los niveles',
        FOREIGN KEY (studio_id) REFERENCES studios (id),
        FOREIGN KEY (instructor_id) REFERENCES instructors (id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        class_id INTEGER NOT NULL,
        status TEXT DEFAULT 'confirmed', -- confirmed, cancelled, completed
        booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        qr_code_id TEXT NOT NULL,
        rating INTEGER,
        review_comment TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (class_id) REFERENCES classes (id)
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'topup', 'subscription', 'booking', 'refund'
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        studio_id INTEGER NOT NULL,
        UNIQUE(user_id, studio_id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (studio_id) REFERENCES studios (id)
    );
    ''')

    conn.commit()

    # Check if seed data exists
    cursor.execute("SELECT COUNT(*) FROM studios")
    if cursor.fetchone()[0] == 0:
        seed_data(conn)

    conn.close()

def seed_data(conn):
    cursor = conn.cursor()
    print("Sembrando red integral de MoveClub: Osorno, Temuco, Santiago y Puerto Varas...")

    # 1. Default User (Prueba Gratuita 7 días - 10 créditos para 2 clases)
    cursor.execute('''
        INSERT INTO users (name, email, credits_balance, plan_tier, avatar_url)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        "María Ignacia Sánchez",
        "sanchezhenriquezmariaignacia99@gmail.com",
        10,
        "Prueba Gratuita (10 créditos / 7 días)",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    ))
    user_id = cursor.lastrowid

    cursor.execute('''
        INSERT INTO credit_transactions (user_id, amount, type, description)
        VALUES (?, ?, ?, ?)
    ''', (user_id, 10, "topup", "🎁 Bono de Bienvenida: 10 Créditos Gratis (Prueba 7 Días - 2 Clases)"))

    # 2. Comprehensive Studios List
    studios = [
        # ==================== OSORNO ====================
        (
            "Pádel Park Osorno & Indoor Club",
            "Pádel",
            "Canchas techadas de cristal panorámico, clínicas de pádel y partidos nivelados",
            "El club de pádel indoor más moderno de Osorno. 4 canchas cubiertas con césped sintético azul texturado, iluminación LED profesional y sistema de reserva por cupo individual para sumarte a partidos.",
            "Av. René Soriano 2400",
            "Osorno",
            "René Soriano",
            -40.5840,
            -73.1090,
            "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
            4.98,
            260,
            "Canchas techadas, Palas de test Bullpadel, Pelotas presurizadas, Camarines con calefacción, Tercer tiempo & Cafetería",
            "+56 64 220 1122",
            "https://padelparkosorno.cl"
        ),
        (
            "Bull Pádel Center Osorno",
            "Pádel",
            "Canchas indoor panorámicas World Padel Tour y entrenamiento técnico",
            "Centro premium de pádel en Osorno. Clínicas dirigidas de smash, bandeja y posicionamiento en pista, además de torneos relámpago con cupos reservados para socios MoveClub.",
            "Ruta 215 Km 2, Sector Pilauco",
            "Osorno",
            "Pilauco",
            -40.5690,
            -73.1280,
            "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop&q=80",
            4.95,
            195,
            "Canchas WPT oficiales, Tienda pro de palas, Duchas, Estacionamiento cerrado, Lounge bar",
            "+56 64 231 4455",
            "https://bullpadelosorno.cl"
        ),
        (
            "Club de Tenis Osorno & Academia",
            "Tenis",
            "Canchas de arcilla / polvo de ladrillo, clínicas de tenis y partidos",
            "Histórico club de tenis en Osorno con canchas de arcilla impecables. Clases particulares y grupales para perfeccionar el revés, servicio y juego de fondo de cancha.",
            "Av. Manuel Rodríguez 1150",
            "Osorno",
            "Centro Osorno",
            -40.5750,
            -73.1360,
            "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80",
            4.92,
            155,
            "Canchas de arcilla, Arriendo de raquetas Babolat, Pelotas Head, Camarines, Club house",
            "+56 64 222 3344",
            "https://tenisosorno.cl"
        ),
        (
            "Studio Danza Sur & Ritmos",
            "Danza",
            "Baile urbano, Dance Fit, Reggaeton, Jazz Contemporáneo y Ritmos Latinos",
            "Espacio de expresión corporal y entrenamiento a través del baile. Quema calorías al ritmo de los mejores beats con coreografías diseñadas para divertirte y sudar.",
            "Av. Juan Mackenna 940",
            "Osorno",
            "Centro Osorno",
            -40.5745,
            -73.1320,
            "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80",
            4.96,
            170,
            "Piso flotante de madera, Espejos panorámicos, Climatización, Vestidores",
            "+56 64 233 4455",
            "https://danzasurosorno.cl"
        ),
        (
            "Osorno Athletic Gym & Fitness",
            "Gimnasio",
            "Acceso Open Gym, máquinas biomecánicas Hammer Strength y peso libre",
            "Gimnasio completo con amplia zona de mancuernas hasta 50kg, racks de sentadillas, máquinas de poleas, caminadoras y zona de estiramiento.",
            "Av. Zenteno 1850",
            "Osorno",
            "Zenteno",
            -40.5810,
            -73.1270,
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
            4.88,
            240,
            "Open Gym libre, Racks olímpicos, Duchas temperadas, Lockers digitales, Smoothie bar",
            "+56 64 244 5566",
            "https://osornoathletic.cl"
        ),
        (
            "Reformer Pilates Osorno",
            "Pilates",
            "Camas Reformer Allegro, postura, flexibilidad y fuerza de abdomen",
            "Estudio boutique de Pilates en máquinas Reformer. Sesiones guiadas de máximo 6 personas para corrección postural y fortalecimiento profundo del core.",
            "Av. República 680",
            "Osorno",
            "Rahue",
            -40.5770,
            -73.1460,
            "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80",
            4.97,
            180,
            "Camas Reformer de última generación, Calcetines antideslizantes, Infusiones, Duchas",
            "+56 64 255 6677",
            "https://pilatesosorno.cl"
        ),
        (
            "Volcán Boulder & Climbing Gym",
            "Escalada & Boulder",
            "Escalada indoor, muros de boulder y fuerza funcional en Osorno",
            "El centro de escalada de referencia en Osorno. Muros de bouldering con problemas para todos los niveles, zona Moonboard y acondicionamiento físico.",
            "Av. Juan Mackenna 1230",
            "Osorno",
            "Centro Osorno",
            -40.5739,
            -73.1345,
            "https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&auto=format&fit=crop&q=80",
            4.95,
            142,
            "Zapatillas de escalada (arriendo), Magnesio, Lockers, Duchas temperadas, Cafetería",
            "+56 64 223 4567",
            "https://volcanboulderosorno.cl"
        ),
        (
            "Kutral CrossFit Osorno",
            "CrossFit",
            "Entrenamiento funcional de alta intensidad y fuerza patagónica",
            "Box oficial afiliado. Clases de fuerza, WOD metabólico y gimnasia deportiva guiadas por coaches certificados.",
            "Av. Zenteno 2100",
            "Osorno",
            "Zenteno",
            -40.5820,
            -73.1250,
            "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
            4.91,
            188,
            "Barras Rogue, Duchas, Estacionamiento, Zona Open Gym, Bebederos filtrados",
            "+56 64 234 5678",
            "https://kutralcrossfit.cl"
        ),
        (
            "Rahue Yoga & Sound Studio",
            "Yoga",
            "Vinyasa Flow, Sound Bath con cuencos y calor frente al entorno del sur",
            "Estudio de yoga en maderas nativas y sala climatizada. Vinyasa, Ashtanga, Hatha y baños sonoros.",
            "Av. República 540",
            "Osorno",
            "Rahue",
            -40.5760,
            -73.1490,
            "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&auto=format&fit=crop&q=80",
            4.96,
            165,
            "Mat incluido, Bloques y mantas, Té de hierbas, Duchas privadas",
            "+56 64 245 6789",
            "https://rahueyoga.cl"
        ),
        (
            "Bosque Nativo Spa & Termas Urbanas",
            "Spa & Bienestar",
            "Saunas de alerce, tinajas de agua fría a 4°C y masajes de descarga muscular",
            "Circuito de contraste térmico con sauna seco nativo a 70°C, tinas de inmersión en hielo y terapia manual.",
            "Av. Francia 1450",
            "Osorno",
            "Francia / Kolbe",
            -40.5890,
            -73.1180,
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80",
            4.97,
            210,
            "Batas de lino, Aromaterapia, Infusiones nativas, Duchas de lluvia",
            "+56 64 256 7890",
            "https://bosquenativospa.cl"
        ),

        # ==================== TEMUCO ====================
        (
            "Temuco Pádel Arena & Club",
            "Pádel",
            "6 canchas indoor climatizadas, clínicas técnicas y partidos de nivel",
            "El complejo de pádel cubierto más grande de La Araucanía. Canchas de cristal panorámico, iluminación LED indirecta y torneos.",
            "Av. Rudecindo Ortega 01750",
            "Temuco",
            "Norte Temuco",
            -38.7180,
            -72.5850,
            "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
            4.96,
            280,
            "6 canchas indoor, Climatización, Arriendo de palas, Camarines con secadores, Restaurante",
            "+56 45 230 8899",
            "https://temucopadelarena.cl"
        ),
        (
            "Club de Tenis Temuco Frontera",
            "Tenis",
            "Canchas de arcilla roja iluminadas y entrenamiento competitivo de tenis",
            "Espacio tradicional de tenis en Temuco. Clases para todos los niveles, desde principiantes que aprenden el saque hasta jugadores avanzados.",
            "Av. Olimpia 1250",
            "Temuco",
            "Estadio Temuco",
            -38.7450,
            -72.6120,
            "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80",
            4.91,
            145,
            "Canchas de arcilla, Iluminación nocturna, Encordado de raquetas, Club house",
            "+56 45 235 6677",
            "https://tenisfrontera.cl"
        ),
        (
            "Academia Danza Viva Temuco",
            "Danza",
            "Hip Hop, Baile Urbano, Ritmos Latinos, Salsa, Bachata y Femme Style",
            "Academia líder en danza en Temuco. Clases energéticas para aprender coreografías, mejorar la coordinación y quemar calorías bailando.",
            "Av. San Martín 0980",
            "Temuco",
            "San Martín",
            -38.7400,
            -72.6030,
            "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80",
            4.95,
            185,
            "Salas con piso de danza, Sistema de audio envolvente, Vestidores, Estacionamiento",
            "+56 45 246 7788",
            "https://danzavivatemuco.cl"
        ),
        (
            "IronFit Gym Temuco",
            "Gimnasio",
            "Open Gym libre, zona de musculación pesada, powerlifting y cardio",
            "Gimnasio moderno con maquinaria biomecánica de primer nivel, zonas de peso libre con plataformas de levantamiento y mancuernas hasta 60kg.",
            "Av. Caupolicán 1650",
            "Temuco",
            "Caupolicán",
            -38.7380,
            -72.5950,
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
            4.89,
            310,
            "Pase libre Open Gym, Plataformas de levantamiento, Lockers, Duchas privadas",
            "+56 45 257 8899",
            "https://ironfittemuco.cl"
        ),
        (
            "Ñielol Reformer & Core Studio",
            "Pilates",
            "Control, tonificación postural y fuerza profunda con camas Reformer",
            "Estudio de Pilates Reformer a los pies del cerro Ñielol. Grupos reducidos de máximo 8 alumnos.",
            "Av. Alemania 0850",
            "Temuco",
            "Av. Alemania",
            -38.7360,
            -72.6070,
            "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80",
            4.98,
            230,
            "Máquinas Reformer Allegro 2, Calcetines antideslizantes, Duchas privadas, Lockers",
            "+56 45 221 3456",
            "https://nielolpilates.cl"
        ),
        (
            "Araucanía Indoor Cycling Lab",
            "Spinning",
            "Ritmo, música inmersiva y sprints de alta intensidad en Temuco",
            "Cycling de concierto con bicicletas Stages, potenciómetros y luces envolventes.",
            "Av. San Martín 1420",
            "Temuco",
            "San Martín",
            -38.7420,
            -72.6010,
            "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80",
            4.92,
            275,
            "Zapatillas clip incluidas, Toallas frías, Smoothie Bar, Duchas premium",
            "+56 45 232 4567",
            "https://araucaniacycle.cl"
        ),
        (
            "Frontera Boxing & Fight Club",
            "Boxeo",
            "Técnica de golpeo a sacos de agua, intervalos HIIT y beats urbanos",
            "10 rounds combinando golpes a sacos de agua Aqua Training con fuerza funcional.",
            "Av. Pablo Neruda 02150",
            "Temuco",
            "Pablo Neruda",
            -38.7480,
            -72.6240,
            "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&auto=format&fit=crop&q=80",
            4.89,
            195,
            "Guantes en arriendo, Vendas protectoras, Duchas, Estacionamiento propio",
            "+56 45 243 5678",
            "https://fronteraboxing.cl"
        ),
        (
            "Centro Acuático & Natación Temuco",
            "Natación",
            "Piscina temperada semi-olímpica de 25m y sesiones de Aqua-HIIT",
            "Complejo acuático climatizado a 28°C todo el año con nado libre y corrección técnica.",
            "Av. Javiera Carrera 1100",
            "Temuco",
            "Javiera Carrera",
            -38.7510,
            -72.6180,
            "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop&q=80",
            4.87,
            160,
            "Gorro y lentes en arriendo, Saunas seco y húmedo, Vestidores",
            "+56 45 254 6789",
            "https://acuaticotemuco.cl"
        ),
        (
            "Kallfu Yoga & Meditación",
            "Yoga",
            "Hatha dinámico, alineación y respiración consciente",
            "Estudio luminoso en Temuco dedicado al bienestar integral y respiración Pranayama.",
            "Av. Inés de Suárez 1040",
            "Temuco",
            "Inés de Suárez",
            -38.7390,
            -72.6150,
            "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=80",
            4.94,
            135,
            "Mats ecológicos, Props y cinturones, Té chai, Estacionamiento",
            "+56 45 265 7890",
            "https://kallfuyoga.cl"
        ),

        # ==================== SANTIAGO ====================
        (
            "Santiago Pádel Club & Rooftop",
            "Pádel",
            "Canchas panorámicas en altura, clínicas de pádel y partidos nivelados",
            "Club de pádel en el corazón del sector oriente de Santiago. Canchas panorámicas de última generación, profesores WPT y tercer tiempo con vista a la cordillera.",
            "Av. Las Condes 12500",
            "Santiago",
            "Las Condes",
            -33.3760,
            -70.5280,
            "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
            4.98,
            340,
            "Canchas panorámicas, Palas Bullpadel, Pelotas nuevas, Cafetería & Rooftop, Estacionamiento",
            "+56 2 2987 6543",
            "https://santiagopadel.cl"
        ),
        (
            "Club de Tenis El Alba",
            "Tenis",
            "Canchas de arcilla iluminadas, clases particulares y dobles competitivos",
            "Prestigioso club de tenis en Las Condes. 8 canchas de arcilla roja con mantención diaria, clínicas de saque y torneos de fin de semana.",
            "Av. Paul Harris 1010",
            "Santiago",
            "Las Condes",
            -33.3980,
            -70.5390,
            "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80",
            4.93,
            210,
            "8 Canchas de arcilla, Iluminación LED, Tienda Head/Wilson, Camarines con sauna",
            "+56 2 2876 5432",
            "https://teniselalba.cl"
        ),
        (
            "Danza Urbana Chile & Academy",
            "Danza",
            "Heels, Reggaeton Fit, K-Pop, Hip Hop y Danza Contemporánea",
            "La academia de baile urbano más destacada de Santiago. Clases dinámicas para todos los niveles donde aprendes coreografías virales mientras quemas hasta 600 calorías.",
            "Av. Manuel Montt 850",
            "Santiago",
            "Providencia",
            -33.4350,
            -70.6180,
            "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80",
            4.97,
            290,
            "Salas climatizadas con piso de rebote, Luces escénicas, Vestidores con lockers",
            "+56 2 2765 4321",
            "https://danzaurbanachile.cl"
        ),
        (
            "PowerHouse Open Gym & Fitness",
            "Gimnasio",
            "Acceso libre Open Gym, máquinas Eleiko, mancuernas pesadas y cardio",
            "El templo del fitness en Providencia. Equipamiento de élite para hipertrofia, levantamiento de potencia y acondicionamiento físico.",
            "Av. Providencia 2150",
            "Santiago",
            "Providencia",
            -33.4240,
            -70.6080,
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
            4.90,
            410,
            "Pase Open Gym ilimitado, Racks Eleiko, Duchas de lujo, Proteína bar",
            "+56 2 2654 3210",
            "https://powerhousechile.cl"
        ),
        (
            "Zen Soul & Sound Yoga",
            "Yoga",
            "Vinyasa Flow, Hot Yoga y baños de sonido con cuencos de cuarzo",
            "Santuario boutique en Providencia diseñado con aromas botánicos y salas a temperatura controlada.",
            "Av. Providencia 1450, Piso 3",
            "Santiago",
            "Providencia",
            -33.4285,
            -70.6124,
            "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&auto=format&fit=crop&q=80",
            4.95,
            184,
            "Mat incluido, Duchas premium, Lockers, Té orgánico, Toallas",
            "+56 2 2543 2109",
            "https://zensoulyoga.cl"
        ),
        (
            "Velocita Indoor Cycling",
            "Spinning",
            "Experiencia inmersiva sobre dos ruedas con sistema de audio de concierto",
            "Cycling con luces rítmicas y coaches que llevarán tu resistencia al límite.",
            "Alonso de Córdova 3890",
            "Santiago",
            "Vitacura",
            -33.3980,
            -70.5890,
            "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80",
            4.92,
            245,
            "Zapatillas clip incluidas, Duchas, Smoothie Bar, Toallas frías, Estacionamiento",
            "+56 2 2432 1098",
            "https://velocitacycle.cl"
        ),
        (
            "IronBox Athletic Club",
            "CrossFit",
            "WOD, levantamiento olímpico y gymnastics con equipamiento Rogue",
            "Box oficial con entrenamientos funcionales de alta exigencia.",
            "Av. Las Condes 9500",
            "Santiago",
            "Las Condes",
            -33.3850,
            -70.5480,
            "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
            4.88,
            310,
            "Lockers, Duchas, Zona Open Gym, Bebederos filtrados",
            "+56 2 2321 0987",
            "https://ironboxclub.cl"
        ),
        (
            "Reformer Core Studio",
            "Pilates",
            "Fuerza profunda y tonificación con camas Reformer Allegro 2",
            "Grupos reducidos de 8 personas con atención y alineación personalizada.",
            "Nueva Costanera 4020",
            "Santiago",
            "Vitacura",
            -33.3950,
            -70.5970,
            "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80",
            4.97,
            160,
            "Calcetines antideslizantes, Lockers, Duchas privadas",
            "+56 2 2210 9876",
            "https://reformercore.cl"
        ),
        (
            "Punch Club & Boxing Gym",
            "Boxeo",
            "Golpes a sacos de agua Aqua Bag y beats urbanos",
            "Quema calorías con combinaciones técnicas de boxeo sin contacto.",
            "Av. Italia 1620",
            "Santiago",
            "Ñuñoa",
            -33.4470,
            -70.6230,
            "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&auto=format&fit=crop&q=80",
            4.85,
            195,
            "Guantes en arriendo, Vendas, Duchas, Estacionamiento",
            "+56 2 2109 8765",
            "https://punchclub.cl"
        ),
        (
            "Glow Wellness & Spa Sanctuary",
            "Spa & Bienestar",
            "Sauna infrarrojo, tinas de hielo y masajes descontracturantes",
            "Santuario de longevidad, presoterapia Normatec y recuperación muscular.",
            "Isidora Goyenechea 3000",
            "Santiago",
            "Las Condes",
            -33.4150,
            -70.5980,
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80",
            4.96,
            140,
            "Batas de lino, Té de hierbas, Aromaterapia, Duchas de lluvia",
            "+56 2 2098 7654",
            "https://glowsanctuary.cl"
        ),
        (
            "AquaFit Olympic Center",
            "Natación",
            "Piscina de 25m climatizada a 28°C y Aqua-Spinning",
            "Nado libre supervisado y clases dirigidas de Aqua-HIIT.",
            "Av. Américo Vespucio Sur 1200",
            "Santiago",
            "Las Condes",
            -33.4210,
            -70.5750,
            "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&auto=format&fit=crop&q=80",
            4.89,
            135,
            "Gorro y lentes en arriendo, Saunas húmedo y seco",
            "+56 2 2987 1122",
            "https://aquafitcenter.cl"
        ),

        # ==================== PUERTO VARAS ====================
        (
            "Llanquihue Lakefront Yoga & Wellness",
            "Yoga",
            "Práctica de Vinyasa con vista panorámica al Lago Llanquihue y Volcanes",
            "Espacio único frente a la costanera con ventanales de piso a techo.",
            "Av. Vicente Pérez Rosales 1600",
            "Puerto Varas",
            "Costanera Puerto Varas",
            -41.3210,
            -72.9820,
            "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&auto=format&fit=crop&q=80",
            4.99,
            280,
            "Mat y mantas de lana, Vista al lago, Café de especialidad, Duchas",
            "+56 65 223 9999",
            "https://llanquihueyoga.cl"
        ),
        (
            "Patagonia Pádel & Tennis Club",
            "Pádel",
            "Canchas techadas de pádel y tenis en el entorno natural de Puerto Varas",
            "Canchas cubiertas con vista a los volcanes, clínicas técnicas de pádel y partidos.",
            "Ruta 225 Km 3, Camino a Ensenada",
            "Puerto Varas",
            "Camino Ensenada",
            -41.3320,
            -72.9540,
            "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80",
            4.96,
            190,
            "Canchas techadas, Palas de test, Quincho con chimenea, Cafetería",
            "+56 65 234 8877",
            "https://patagoniapadel.cl"
        )
    ]

    studio_ids = {}
    for s in studios:
        cursor.execute('''
            INSERT INTO studios (name, category, tagline, description, address, city, neighborhood, latitude, longitude, image_url, rating, review_count, amenities, phone, website)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', s)
        studio_ids[s[0]] = cursor.lastrowid

    # 3. Seed Instructors
    instructors_data = [
        # Osorno
        (studio_ids["Pádel Park Osorno & Indoor Club"], "Matías 'Mati' Gómez", "Head Coach certificado FEP y jugador 1ª categoría.", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80", "Pádel Clínicas & Táctica"),
        (studio_ids["Bull Pádel Center Osorno"], "Gonzalo Arismendi", "Profesor de pádel especializado en bandeja y salida de pared.", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", "Técnica de Pádel"),
        (studio_ids["Club de Tenis Osorno & Academia"], "Ignacio 'Nacho' Carrasco", "Coach nacional de tenis y ex-tenista ATP ranking.", "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80", "Tenis Avanzado & Saque"),
        (studio_ids["Studio Danza Sur & Ritmos"], "Valeska Pineda", "Bailarina profesional y coreógrafa de ritmos urbanos y latinos.", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", "Dance Fit & Urbano"),
        (studio_ids["Osorno Athletic Gym & Fitness"], "Felipe Cárdenas", "Preparador físico y entrenador de fuerza e hipertrofia.", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80", "Fuerza & Musculación"),
        (studio_ids["Reformer Pilates Osorno"], "Constanza Vera", "Instructora certificada en Pilates Reformer y postura.", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80", "Pilates Reformer"),
        (studio_ids["Volcán Boulder & Climbing Gym"], "Cristóbal 'Mono' Vidal", "Guía de montaña UIAGM y escalador con 12 años en Cochamó.", "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&auto=format&fit=crop&q=80", "Bouldering & Agarre"),
        (studio_ids["Kutral CrossFit Osorno"], "Nicolás 'Kutral' Bahamondes", "Head Coach CrossFit L2 y preparador físico.", "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&auto=format&fit=crop&q=80", "WOD & Halterofilia"),
        (studio_ids["Rahue Yoga & Sound Studio"], "Fernanda Angulo", "Instructora certificada en Vinyasa Flow y sonoterapeuta.", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80", "Vinyasa & Sound Bath"),
        (studio_ids["Bosque Nativo Spa & Termas Urbanas"], "Dra. Javiera Neumann", "Terapeuta en fisioterapia y protocolos de sauna + hielo.", "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80", "Sauna & Biohacking"),

        # Temuco
        (studio_ids["Temuco Pádel Arena & Club"], "Rodrigo 'Chapa' Silva", "Entrenador nacional de pádel y organizador de torneos.", "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80", "Pádel Clínicas"),
        (studio_ids["Club de Tenis Temuco Frontera"], "Patricio Cornejo", "Profesor de tenis formativo y competitivo.", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", "Tenis & Estrategia"),
        (studio_ids["Academia Danza Viva Temuco"], "Sofía Manríquez", "Coreógrafa de Hip Hop y ritmos latinos.", "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80", "Dance Fusion & Heels"),
        (studio_ids["IronFit Gym Temuco"], "Andrés 'Titan' Valdés", "Coach de Powerlifting y entrenamiento de fuerza.", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80", "Musculación & Racks"),
        (studio_ids["Ñielol Reformer & Core Studio"], "Catalina Mellado", "Master Trainer en Pilates Reformer.", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80", "Pilates Reformer"),
        (studio_ids["Araucanía Indoor Cycling Lab"], "Esteban Riquelme", "Especialista en ciclismo de ruta y potencia musical.", "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80", "Cycling de Potencia"),
        (studio_ids["Frontera Boxing & Fight Club"], "Sebastián 'Puma' Alarcón", "Ex-campeón de boxeo y entrenador funcional.", "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&auto=format&fit=crop&q=80", "Boxing Rounds"),
        (studio_ids["Centro Acuático & Natación Temuco"], "Marcelo Huenchumil", "Entrenador de natación competitiva y rescate acuático.", "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80", "Natación & Aqua-HIIT"),
        (studio_ids["Kallfu Yoga & Meditación"], "Paz Troncoso", "Profesora de Hatha & Pranayama.", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80", "Hatha & Meditación"),

        # Santiago
        (studio_ids["Santiago Pádel Club & Rooftop"], "Lucas 'Mago' Beltrán", "Jugador profesional de pádel y Head Coach.", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80", "Pádel Pro"),
        (studio_ids["Club de Tenis El Alba"], "Nicolás Massú Jr.", "Coach de tenis de alta competencia y clínicas de dobles.", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", "Tenis & Táctica"),
        (studio_ids["Danza Urbana Chile & Academy"], "Bárbara 'Babi' Moscoso", "Bailarina internacional de tours de conciertos y Dance Fit.", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", "Reggaeton Fit & Heels"),
        (studio_ids["PowerHouse Open Gym & Fitness"], "Héctor 'Hulk' Morales", "Campeón nacional de físico-culturismo y preparador.", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80", "Open Gym & Hipertrofia"),
        (studio_ids["Zen Soul & Sound Yoga"], "Camila Valenzuela", "Instructora 500-RYT en Vinyasa & Yin Yoga.", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80", "Vinyasa Flow"),
        (studio_ids["Velocita Indoor Cycling"], "Sofía Morales", "Lead Coach de cycling con playlists de alta energía.", "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80", "Rhythm Cycling"),
        (studio_ids["IronBox Athletic Club"], "Rodrigo 'Toro' Bravo", "Head Coach CrossFit L3 y Halterofilia.", "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&auto=format&fit=crop&q=80", "CrossFit WOD"),
        (studio_ids["Reformer Core Studio"], "Valentina Ruiz", "Master Trainer en Pilates Reformer.", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80", "Pilates Reformer"),
        (studio_ids["Punch Club & Boxing Gym"], "Carlos 'Rocky' Mendez", "Ex boxeador federado y entrenador de combate.", "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80", "Boxing HIIT"),
        (studio_ids["Glow Wellness & Spa Sanctuary"], "Dra. Elena Costa", "Especialista en recuperación y contrastes térmicos.", "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80", "Recovery & Biohacking"),
        (studio_ids["AquaFit Olympic Center"], "Javier Ossa", "Entrenador nacional de natación máster.", "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80", "Natación"),

        # Puerto Varas
        (studio_ids["Llanquihue Lakefront Yoga & Wellness"], "Camila Rosas", "Instructora 500-RYT en Yoga frente al lago.", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", "Vinyasa Flow"),
        (studio_ids["Patagonia Pádel & Tennis Club"], "Diego 'Patagón' Soto", "Profesor de pádel y tenis en el lago.", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", "Pádel Patagónico")
    ]

    instructor_ids = {}
    for inst in instructors_data:
        cursor.execute('''
            INSERT INTO instructors (studio_id, name, bio, avatar_url, specialty)
            VALUES (?, ?, ?, ?, ?)
        ''', inst)
        instructor_ids[inst[1]] = cursor.lastrowid

    # 4. Generate dynamic classes for 5 days across ALL categories and cities
    now = datetime.now()

    class_templates = [
        # Osorno
        (studio_ids["Pádel Park Osorno & Indoor Club"], instructor_ids["Matías 'Mati' Gómez"], "Clínica Técnica de Pádel & Bandeja", "Pádel", 60, 5, 4, "Perfeccionamiento de bandeja, salida de pared y volea en cancha techada.", "Intermedio"),
        (studio_ids["Pádel Park Osorno & Indoor Club"], instructor_ids["Matías 'Mati' Gómez"], "Rey de la Pista (Cupo Individual)", "Pádel", 75, 5, 4, "Te asignamos compañero y rivales de tu misma categoría para 1h15 de juego.", "Todos los niveles"),
        (studio_ids["Club de Tenis Osorno & Academia"], instructor_ids["Ignacio 'Nacho' Carrasco"], "Clínica de Tenis: Drive & Revés con Topspin", "Tenis", 60, 5, 4, "Clase práctica en polvo de ladrillo para aceleración de raqueta y profundidad.", "Todos los niveles"),
        (studio_ids["Studio Danza Sur & Ritmos"], instructor_ids["Valeska Pineda"], "Dance Fit & Ritmos Latinos", "Danza", 50, 4, 16, "Cardio bailable combinando salsa, reggaeton y bachata para quemar calorías.", "Todos los niveles"),
        (studio_ids["Osorno Athletic Gym & Fitness"], instructor_ids["Felipe Cárdenas"], "Pase Open Gym Libre & Musculación", "Gimnasio", 90, 3, 20, "Acceso libre total a la sala de pesas, máquinas guiadas y zona de cardio.", "Todos los niveles"),
        (studio_ids["Reformer Pilates Osorno"], instructor_ids["Constanza Vera"], "Reformer Core & Posture Alignment", "Pilates", 50, 7, 6, "Trabajo en resortes Allegro para fortalecer el abdomen y liberar tensión lumbar.", "Todos los niveles"),
        (studio_ids["Volcán Boulder & Climbing Gym"], instructor_ids["Cristóbal 'Mono' Vidal"], "Bouldering Técnico & Fuerza de Agarre", "Escalada & Boulder", 55, 4, 12, "Técnica de pies y acondicionamiento muscular en muros de boulder.", "Todos los niveles"),
        (studio_ids["Kutral CrossFit Osorno"], instructor_ids["Nicolás 'Kutral' Bahamondes"], "WOD Patagónico & Halterofilia", "CrossFit", 60, 5, 14, "Levantamiento olímpico de Clean & Jerk y circuito metabólico.", "Todos los niveles"),
        (studio_ids["Rahue Yoga & Sound Studio"], instructor_ids["Fernanda Angulo"], "Vinyasa Flow & Respiración Sureña", "Yoga", 50, 4, 14, "Secuencia fluida con calor suave para abrir el pecho y calmar la mente.", "Todos los niveles"),
        (studio_ids["Bosque Nativo Spa & Termas Urbanas"], instructor_ids["Dra. Javiera Neumann"], "Circuito Sauna Alerce + Inmersión Fría", "Spa & Bienestar", 45, 6, 6, "15 min en sauna seco nativo seguidos de inmersión en tina helada a 4°C.", "Bienestar"),

        # Temuco
        (studio_ids["Temuco Pádel Arena & Club"], instructor_ids["Rodrigo 'Chapa' Silva"], "Clínica de Pádel Avanzado & Estrategia", "Pádel", 60, 5, 4, "Táctica de juego en parejas y transiciones defensa-ataque.", "Intermedio/Avanzado"),
        (studio_ids["Club de Tenis Temuco Frontera"], instructor_ids["Patricio Cornejo"], "Entrenamiento de Tenis: Saque & Red", "Tenis", 60, 5, 4, "Biomecánica del servicio y definición de voleas en la red.", "Todos los niveles"),
        (studio_ids["Academia Danza Viva Temuco"], instructor_ids["Sofía Manríquez"], "Reggaeton Urbano & Dance Fusion", "Danza", 50, 4, 18, "Coreografías de alta energía con los tracks más pegados del momento.", "Todos los niveles"),
        (studio_ids["IronFit Gym Temuco"], instructor_ids["Andrés 'Titan' Valdés"], "Pase Libre Open Gym & Fuerza", "Gimnasio", 90, 3, 25, "Entrenamiento libre en sala de máquinas pesadas y plataformas de levantamiento.", "Todos los niveles"),
        (studio_ids["Ñielol Reformer & Core Studio"], instructor_ids["Catalina Mellado"], "Reformer Total Tone & Postura", "Pilates", 50, 7, 8, "Alineación de columna y tonificación de piernas y glúteos en cama Reformer.", "Todos los niveles"),
        (studio_ids["Araucanía Indoor Cycling Lab"], instructor_ids["Esteban Riquelme"], "Full Beat 45' Cycling Temuco", "Spinning", 45, 5, 20, "Pedaleo al ritmo de las mejores pistas con intervalos de potencia.", "Todos los niveles"),
        (studio_ids["Frontera Boxing & Fight Club"], instructor_ids["Sebastián 'Puma' Alarcón"], "10 Rounds Boxing Beats", "Boxeo", 50, 5, 16, "Golpes técnicos a sacos de agua con intervalos HIIT.", "Todos los niveles"),
        (studio_ids["Centro Acuático & Natación Temuco"], instructor_ids["Marcelo Huenchumil"], "Nado Técnico & Aqua-HIIT", "Natación", 45, 4, 12, "Perfeccionamiento de estilo en piscina climatizada a 28°C.", "Todos los niveles"),
        (studio_ids["Kallfu Yoga & Meditación"], instructor_ids["Paz Troncoso"], "Hatha Yoga & Pranayama", "Yoga", 50, 4, 12, "Posturas estables y técnicas de respiración profunda.", "Todos los niveles"),

        # Santiago
        (studio_ids["Santiago Pádel Club & Rooftop"], instructor_ids["Lucas 'Mago' Beltrán"], "Masterclass de Pádel en Altura", "Pádel", 60, 6, 4, "Lectura de juego, bandeja de potencia y definición aérea en cancha panorámica.", "Intermedio/Avanzado"),
        (studio_ids["Club de Tenis El Alba"], instructor_ids["Nicolás Massú Jr."], "Clínica de Tenis de Alta Competencia", "Tenis", 60, 6, 4, "Patrones de juego de fondo de cancha y aceleración con efecto.", "Intermedio/Avanzado"),
        (studio_ids["Danza Urbana Chile & Academy"], instructor_ids["Bárbara 'Babi' Moscoso"], "Heels & Commercial Dance Fit", "Danza", 55, 4, 20, "Sensualidad, postura, coordinación y cardio intenso en tacones o zapatillas.", "Todos los niveles"),
        (studio_ids["PowerHouse Open Gym & Fitness"], instructor_ids["Héctor 'Hulk' Morales"], "Pase Open Gym Eleiko & Musculación", "Gimnasio", 90, 3, 30, "Acceso a máquinas de hipertrofia, plataformas de peso muerto y mancuernas hasta 60kg.", "Todos los niveles"),
        (studio_ids["Zen Soul & Sound Yoga"], instructor_ids["Camila Valenzuela"], "Vinyasa Flow & Deep Stretch", "Yoga", 50, 4, 15, "Fluidez de movimiento sincronizada con la respiración.", "Todos los niveles"),
        (studio_ids["Velocita Indoor Cycling"], instructor_ids["Sofía Morales"], "Full Beat 45' Ride Santiago", "Spinning", 45, 5, 24, "Coreografías dinámicas y sprints de alta intensidad.", "Todos los niveles"),
        (studio_ids["IronBox Athletic Club"], instructor_ids["Rodrigo 'Toro' Bravo"], "WOD Hero & Halterofilia", "CrossFit", 60, 6, 14, "Fuerza en sentadilla trasera y circuito metabólico de alta exigencia.", "Todos los niveles"),
        (studio_ids["Reformer Core Studio"], instructor_ids["Valentina Ruiz"], "Classical Reformer Alignment", "Pilates", 55, 6, 10, "El método clásico de Joseph Pilates enfocado en control y centro de poder.", "Todos los niveles"),
        (studio_ids["Punch Club & Boxing Gym"], instructor_ids["Carlos 'Rocky' Mendez"], "Heavy Bag Beats 50'", "Boxeo", 50, 5, 18, "Combinaciones de golpes técnicos a sacos de agua Aqua Bag.", "Todos los niveles"),
        (studio_ids["Glow Wellness & Spa Sanctuary"], instructor_ids["Dra. Elena Costa"], "Circuito Recovery: Sauna + Ice Bath", "Spa & Bienestar", 45, 6, 6, "Sauna infrarrojo a 65°C seguido de inmersión en frío a 4°C.", "Bienestar"),
        (studio_ids["AquaFit Olympic Center"], instructor_ids["Javier Ossa"], "Aqua-HIIT & Resistencia", "Natación", 45, 4, 14, "Ejercicios funcionales con pesas acuáticas en piscina temperada.", "Todos los niveles"),

        # Puerto Varas
        (studio_ids["Llanquihue Lakefront Yoga & Wellness"], instructor_ids["Camila Rosas"], "Yoga frente al Lago & Volcanes", "Yoga", 55, 5, 14, "Vinyasa flow mirando el atardecer sobre el Lago Llanquihue.", "Todos los niveles"),
        (studio_ids["Patagonia Pádel & Tennis Club"], instructor_ids["Diego 'Patagón' Soto"], "Pádel Indoor Patagónico (Partido Nivelado)", "Pádel", 60, 5, 4, "Match nivelado en cancha techada con chimenea y tercer tiempo.", "Todos los niveles")
    ]

    hours = ["07:00", "08:30", "10:00", "12:30", "17:30", "19:00", "20:15"]

    class_id_created = []
    for day_offset in range(5):
        target_date = now + timedelta(days=day_offset)
        date_str = target_date.strftime('%Y-%m-%d')
        
        for idx, template in enumerate(class_templates):
            h = hours[(idx + day_offset) % len(hours)]
            start_time = f"{date_str} {h}"
            
            max_cap = template[6]
            spots = max_cap - ((idx * 2 + day_offset * 3) % (max_cap - 1 if max_cap > 1 else 1))
            if spots <= 0:
                spots = 1

            cursor.execute('''
                INSERT INTO classes (studio_id, instructor_id, title, category, start_time, duration_minutes, credit_cost, max_capacity, available_spots, description, level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                template[0], template[1], template[2], template[3],
                start_time, template[4], template[5], max_cap, spots,
                template[7], template[8]
            ))
            class_id_created.append(cursor.lastrowid)

    if class_id_created:
        first_class = class_id_created[0]
        cursor.execute('''
            INSERT INTO bookings (user_id, class_id, status, qr_code_id)
            VALUES (?, ?, 'confirmed', ?)
        ''', (user_id, first_class, "MC-BOOK-77291-PASS"))

    cursor.execute('''
        INSERT INTO favorites (user_id, studio_id)
        VALUES (?, ?)
    ''', (user_id, studio_ids["Pádel Park Osorno & Indoor Club"]))
    cursor.execute('''
        INSERT INTO favorites (user_id, studio_id)
        VALUES (?, ?)
    ''', (user_id, studio_ids["Santiago Pádel Club & Rooftop"]))

    conn.commit()
    print("¡Base de datos sembrada con éxito con 32 estudios y todas las disciplinas en Osorno, Temuco, Santiago y Puerto Varas!")

if __name__ == "__main__":
    init_db(force_reseed=True)
