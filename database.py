import sqlite3
import os
import json

if os.path.exists('/tmp') and os.access('/tmp', os.W_OK):
    DB_FILE = '/tmp/proyectabm.db'
else:
    DB_FILE = os.path.join(os.path.dirname(__file__), 'proyectabm.db')

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Table for Users (Usuarios con acceso @bmining.cl)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Seed default @bmining.cl users if empty
    cursor.execute('SELECT COUNT(*) FROM usuarios')
    if cursor.fetchone()[0] == 0:
        import werkzeug.security
        default_users = [
            ("Daniel Mesa", "daniel.mesa@bmining.cl", werkzeug.security.generate_password_hash("bmining_pass_123")),
            ("Rodrigo Poblete", "rodrigo.poblete@bmining.cl", werkzeug.security.generate_password_hash("bmining_pass_123"))
        ]
        cursor.executemany(
            'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)',
            default_users
        )

    # Table for Cost Profiles (Catálogo de Perfiles de Costo)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS perfiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            tarifa_costo REAL NOT NULL,
            descripcion TEXT
        )
    ''')

    # Table for Saved Projections Header
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS proyecciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_proyecto TEXT NOT NULL,
            cliente TEXT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            modo_margen TEXT DEFAULT 'costo',
            margen_global REAL DEFAULT 15.0,
            unidad_escala REAL DEFAULT 1.0,
            user_id INTEGER,
            datos_json TEXT NOT NULL
        )
    ''')
    try:
        cursor.execute("ALTER TABLE proyecciones ADD COLUMN unidad_escala REAL DEFAULT 1.0")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE proyecciones ADD COLUMN user_id INTEGER")
    except Exception:
        pass

    # Table for Cost Profiles (Catálogo de Perfiles de Costo en UF/hora)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS perfiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            tarifa_costo REAL NOT NULL, -- Expresado en UF/hora (ej: 0.5 a 2.5 UF)
            descripcion TEXT
        )
    ''')

    # Cleanup legacy perfiles with rate > 10.0 UF if any exist
    cursor.execute('SELECT MAX(tarifa_costo) FROM perfiles')
    max_rate = cursor.fetchone()[0]
    if max_rate is not None and max_rate > 10.0:
        cursor.execute('DELETE FROM perfiles')
    
    conn.commit()
    conn.close()

def get_perfiles():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM perfiles ORDER BY tarifa_costo DESC')
    perfiles = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return perfiles

def clear_all_perfiles():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM perfiles')
    conn.commit()
    conn.close()

def clear_all_data():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM perfiles')
    cursor.execute('DELETE FROM proyecciones')
    conn.commit()
    conn.close()

def add_perfil(nombre, tarifa_costo, descripcion=''):
    return upsert_perfil(nombre, tarifa_costo, descripcion)

def upsert_perfil(nombre, tarifa_costo, descripcion=''):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM perfiles WHERE LOWER(nombre) = ?', (nombre.lower().strip(),))
    existing = cursor.fetchone()
    if existing:
        cursor.execute(
            'UPDATE perfiles SET tarifa_costo = ?, descripcion = ? WHERE id = ?',
            (float(tarifa_costo), descripcion, existing['id'])
        )
        profile_id = existing['id']
    else:
        cursor.execute(
            'INSERT INTO perfiles (nombre, tarifa_costo, descripcion) VALUES (?, ?, ?)',
            (nombre.strip(), float(tarifa_costo), descripcion)
        )
        profile_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return profile_id

def delete_perfil(perfil_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM perfiles WHERE id = ?', (perfil_id,))
    conn.commit()
    conn.close()

def get_proyecciones():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, nombre_proyecto, cliente, fecha, modo_margen, margen_global FROM proyecciones ORDER BY fecha DESC')
    proyecciones = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return proyecciones

def get_proyeccion(proyeccion_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM proyecciones WHERE id = ?', (proyeccion_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        res = dict(row)
        res['datos'] = json.loads(res['datos_json'])
        del res['datos_json']
        return res
    return None

def save_proyeccion(nombre_proyecto, cliente, modo_margen, margen_global, items_data, proyeccion_id=None, unidad_escala=1000.0):
    conn = get_connection()
    cursor = conn.cursor()
    datos_json = json.dumps(items_data, ensure_ascii=False)
    
    if proyeccion_id:
        cursor.execute('''
            UPDATE proyecciones 
            SET nombre_proyecto = ?, cliente = ?, modo_margen = ?, margen_global = ?, unidad_escala = ?, datos_json = ?
            WHERE id = ?
        ''', (nombre_proyecto, cliente, modo_margen, float(margen_global), float(unidad_escala), datos_json, proyeccion_id))
        res_id = proyeccion_id
    else:
        cursor.execute('''
            INSERT INTO proyecciones (nombre_proyecto, cliente, modo_margen, margen_global, unidad_escala, datos_json)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (nombre_proyecto, cliente, modo_margen, float(margen_global), float(unidad_escala), datos_json))
        res_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    return res_id

def delete_proyeccion(proyeccion_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM proyecciones WHERE id = ?', (proyeccion_id,))
    conn.commit()
    conn.close()

# USER AUTHENTICATION DATABASE FUNCTIONS
def create_user(nombre, email, password_hash):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)',
        (nombre, email.lower().strip(), password_hash)
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    return user_id

def get_user_by_email(email):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM usuarios WHERE LOWER(email) = ?', (email.lower().strip(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_id(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, nombre, email, fecha_registro FROM usuarios WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
