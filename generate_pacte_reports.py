# -*- coding: utf-8 -*-
"""
Generador de los 9 Informes Oficiales Completos del Proyecto PACTE - HIDROSYS EC.
Autor del Proyecto: Freddy Peñafiel
Tutor Académico: Ing. Fabricio Lucero
Institución: Instituto Superior Tecnológico del Austro - Carrera de Tecnología Superior en Desarrollo de Software
"""

import os
import subprocess

OUTPUT_DIR = r"C:\Users\fredd\.gemini\antigravity\scratch\hidrosys-system\INFORMES_PACTE_SEPARADOS"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# Función auxiliar para dibujar un Actor UML (Muñeco Stick Figure) en SVG
def svg_actor(x, y, label, role_sub="", color="#002e6e"):
    return f"""
    <g transform="translate({x}, {y})">
        <!-- Cabeza -->
        <circle cx="0" cy="-35" r="14" fill="{color}" stroke="#1e40af" stroke-width="2.5"/>
        <!-- Cuerpo -->
        <line x1="0" y1="-21" x2="0" y2="16" stroke="{color}" stroke-width="3.5" stroke-linecap="round"/>
        <!-- Brazos -->
        <line x1="-22" y1="-7" x2="22" y2="-7" stroke="{color}" stroke-width="3.5" stroke-linecap="round"/>
        <!-- Piernas -->
        <line x1="0" y1="16" x2="-18" y2="44" stroke="{color}" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="0" y1="16" x2="18" y2="44" stroke="{color}" stroke-width="3.5" stroke-linecap="round"/>
        <!-- Etiqueta Principal -->
        <text x="0" y="64" font-family="'Outfit', sans-serif" font-size="12" font-weight="800" fill="#0f172a" text-anchor="middle">{label}</text>
        <!-- Subtítulo Rol -->
        <text x="0" y="79" font-family="'Inter', sans-serif" font-size="9.5" font-weight="600" fill="#475569" text-anchor="middle">{role_sub}</text>
    </g>
    """

COVER_TEMPLATE = """
    <!-- ==================== PORTADA UNIVERSITARIA OFICIAL ==================== -->
    <div class="cover-page">
        <div class="cover-header">
            <div class="cover-logo-area">
                <svg width="68" height="68" viewBox="0 0 100 100" style="margin-right:18px;">
                    <path d="M10,20 Q10,10 50,10 Q90,10 90,20 L90,60 Q90,90 50,95 Q10,90 10,60 Z" fill="#002e6e" stroke="#ffffff" stroke-width="2"/>
                    <path d="M20,40 Q35,35 50,40 Q65,45 80,40" fill="none" stroke="#2563eb" stroke-width="4"/>
                    <path d="M20,55 Q35,50 50,55 Q65,60 80,55" fill="none" stroke="#60a5fa" stroke-width="4"/>
                    <polygon points="30,35 50,15 70,35" fill="#f59e0b"/>
                </svg>
                <div>
                    <div class="cover-title-univ">INSTITUTO SUPERIOR TECNOLÓGICO DEL AUSTRO</div>
                    <div class="cover-subtitle-univ">FORMACIÓN TECNOLÓGICA DE ALTO NIVEL</div>
                </div>
            </div>
            
            <div class="cover-meta-grid">
                <div class="meta-box">
                    <span class="meta-label">CARRERA ACADÉMICA</span>
                    <span class="meta-value">TECNOLOGÍA SUPERIOR EN DESARROLLO DE SOFTWARE</span>
                </div>
                <div class="meta-box">
                    <span class="meta-label">MODALIDAD DE PROYECTO</span>
                    <span class="meta-value">PROYECTO DE APLICACIÓN PRÁCTICA Y TECNOLOGÍA (PACTE)</span>
                </div>
            </div>
        </div>

        <div class="cover-center">
            <div class="doc-badge">{doc_code} • DOCUMENTACIÓN TÉCNICA OFICIAL</div>
            <h1 class="cover-project-title">SISTEMA INTEGRAL DE GESTIÓN DE CITAS, ASISTENTE VIRTUAL POR WHATSAPP Y CONTROL DE ÓRDENES TÉCNICAS (HIDROSYS EC.)</h1>
            <h2 class="cover-doc-title">{doc_title}</h2>
            <p class="cover-doc-summary">{doc_summary}</p>
        </div>

        <div class="cover-footer">
            <div class="authors-grid">
                <div class="author-card">
                    <span class="author-role">AUTOR / ESTUDIANTE INVESTIGADOR</span>
                    <span class="author-name">Freddy Peñafiel</span>
                    <span class="author-desc">Desarrollador y Arquitecto Principal • Hidrosys EC.</span>
                </div>
                <div class="author-card">
                    <span class="author-role">DOCENTE / TUTOR DE PROYECTO</span>
                    <span class="author-name">Ing. Fabricio Lucero</span>
                    <span class="author-desc">Director Académico de Proyecto PACTE • ISTA</span>
                </div>
            </div>
            <div class="cover-date">Cuenca, Ecuador • Año Académico 2026</div>
        </div>
    </div>
"""

CSS_STYLES = """
    @page {
        size: A4;
        margin: 20mm 16mm 20mm 16mm;
        @bottom-right {
            content: "Página " counter(page);
            font-family: 'Inter', sans-serif;
            font-size: 8.5pt;
            color: #475569;
        }
        @bottom-left {
            content: "HIDROSYS EC. • Proyecto PACTE • Autor: Freddy Peñafiel | Tutor: Ing. Fabricio Lucero";
            font-family: 'Inter', sans-serif;
            font-size: 8.5pt;
            color: #475569;
        }
    }

    :root {
        --primary: #0f172a;
        --primary-light: #1e293b;
        --accent: #2563eb;
        --ista-blue: #002e6e;
        --success: #10b981;
        --warning: #f59e0b;
        --danger: #ef4444;
        --gray-100: #f8fafc;
        --gray-200: #e2e8f0;
        --gray-300: #cbd5e1;
        --gray-700: #334155;
        --gray-900: #0f172a;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--gray-700);
        line-height: 1.6;
        background: white;
        font-size: 10pt;
    }

    .container { max-width: 100%; margin: 0 auto; }

    /* Portada Estilo Universitario */
    .cover-page {
        height: 92vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 5px 10px;
        page-break-after: always;
    }
    .cover-header { border-bottom: 3px solid var(--ista-blue); padding-bottom: 20px; }
    .cover-logo-area { display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
    .cover-title-univ {
        font-family: 'Outfit', sans-serif;
        font-size: 1.55rem;
        font-weight: 800;
        color: var(--ista-blue);
        letter-spacing: 0.5px;
    }
    .cover-subtitle-univ { font-size: 0.9rem; font-weight: 600; color: #475569; letter-spacing: 2px; }
    .cover-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
    .meta-box { background: var(--gray-100); padding: 10px 14px; border-left: 4px solid var(--accent); border-radius: 4px; }
    .meta-label { display: block; font-size: 0.72rem; font-weight: 700; color: #64748b; letter-spacing: 1px; }
    .meta-value { font-size: 0.9rem; font-weight: 700; color: var(--primary); }

    .cover-center { text-align: center; padding: 30px 15px; }
    .doc-badge {
        display: inline-block;
        background: #eff6ff;
        color: var(--accent);
        font-weight: 700;
        font-size: 0.85rem;
        padding: 6px 16px;
        border-radius: 20px;
        letter-spacing: 1.5px;
        margin-bottom: 18px;
        border: 1px solid #bfdbfe;
    }
    .cover-project-title {
        font-family: 'Outfit', sans-serif;
        font-size: 1.38rem;
        font-weight: 800;
        color: var(--primary);
        line-height: 1.4;
        margin-bottom: 18px;
    }
    .cover-doc-title {
        font-family: 'Outfit', sans-serif;
        font-size: 1.7rem;
        font-weight: 800;
        color: var(--ista-blue);
        margin-bottom: 14px;
        padding: 12px 0;
        border-top: 1px solid var(--gray-200);
        border-bottom: 1px solid var(--gray-200);
    }
    .cover-doc-summary {
        font-size: 1rem;
        color: #475569;
        max-width: 88%;
        margin: 0 auto;
    }

    .cover-footer { border-top: 2px solid var(--gray-200); padding-top: 20px; }
    .authors-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px; }
    .author-card { background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid var(--gray-200); }
    .author-role { display: block; font-size: 0.72rem; font-weight: 700; color: var(--accent); letter-spacing: 1px; }
    .author-name { display: block; font-size: 1.15rem; font-weight: 800; color: var(--primary); margin: 4px 0; }
    .author-desc { font-size: 0.85rem; color: #64748b; }
    .cover-date { text-align: center; font-size: 0.9rem; font-weight: 600; color: #64748b; }

    /* Contenido General */
    .page-break { page-break-after: always; }
    h1, h2, h3, h4 { font-family: 'Outfit', sans-serif; color: var(--primary); margin-top: 22px; margin-bottom: 10px; }
    h1 { font-size: 1.55rem; border-bottom: 2px solid var(--ista-blue); padding-bottom: 8px; }
    h2 { font-size: 1.28rem; color: var(--ista-blue); }
    h3 { font-size: 1.12rem; }
    p { margin-bottom: 14px; text-align: justify; }

    table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 9.2pt; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: var(--ista-blue); color: white; padding: 10px 10px; text-align: left; font-weight: 600; }
    td { padding: 9px 10px; border-bottom: 1px solid var(--gray-200); vertical-align: top; }
    tr:nth-child(even) { background: #f8fafc; }

    .card { background: #f8fafc; border: 1px solid var(--gray-200); border-radius: 8px; padding: 16px; margin: 16px 0; page-break-inside: avoid; }
    .card-title { font-weight: 700; color: var(--ista-blue); margin-bottom: 8px; font-size: 11pt; }

    .badge-req { display: inline-block; background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 4px; font-weight: 700; font-size: 8.2pt; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }

    ul, ol { margin-left: 22px; margin-bottom: 14px; }
    li { margin-bottom: 7px; text-align: justify; }

    .diagram-box {
        background: #ffffff;
        border: 2px solid var(--gray-200);
        border-radius: 10px;
        padding: 20px 12px;
        margin: 20px 0;
        text-align: center;
        page-break-inside: avoid;
    }
    .diagram-caption {
        font-weight: 700;
        font-size: 9.5pt;
        color: var(--ista-blue);
        margin-top: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .explanation-box {
        background: #f1f5f9;
        border-left: 4px solid var(--ista-blue);
        padding: 14px 16px;
        margin: 14px 0;
        font-size: 9.5pt;
        color: #334155;
        text-align: justify;
    }
"""

def wrap_html(doc_code, doc_title, doc_summary, content_body):
    cover = COVER_TEMPLATE.format(doc_code=doc_code, doc_title=doc_title, doc_summary=doc_summary)
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{doc_code} - {doc_title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
{CSS_STYLES}
    </style>
</head>
<body>
<div class="container">
{cover}
<div class="content-body">
{content_body}
</div>
</div>
</body>
</html>
"""
    return html

# =========================================================================
# DOCUMENTO 1: NECESIDADES DEL USUARIO Y STAKEHOLDERS (EXHAUSTIVO + ACTORES)
# =========================================================================
DOC1_CONTENT = f"""
<h1>1. ANÁLISIS INTEGRAL DE NECESIDADES DEL USUARIO Y STAKEHOLDERS</h1>
<p>
El presente informe técnico desarrolla de manera profunda y humanizada el diagnóstico operativo, el estudio de requerimientos de negocio y el análisis estructurado de necesidades que dieron origen al proyecto tecnológico <strong>Hidrosys EC.</strong>. En un contexto industrial donde las empresas de mantenimiento hidráulico, agua potable e instalaciones sanitarias y de gas enfrentan un alto volumen de solicitudes ciudadanas, la dependencia de medios manuales y líneas telefónicas tradicionales genera cuellos de botella insostenibles.
</p>
<p>
A lo largo de este documento, elaboraremos un recorrido sistemático por las motivaciones de cada rol institucional, examinando cómo la implementación de un Asistente Virtual en WhatsApp (basado en Baileys y Node.js) junto con un Dashboard Web de Administración resuelve los puntos críticos de dolor que experimentaban tanto los clientes como el personal operativo de la empresa.
</p>

<h2>1.1 Diagnóstico del Entorno Operativo y Contexto del Sector</h2>
<p>
Las empresas orientadas al servicio técnico residencial e industrial de agua y gas requieren coordinar visitas presenciales de técnicos altamente calificados. En el modelo operativo previo a la implementación de <strong>Hidrosys EC.</strong>, el flujo de atención presentaba las siguientes deficiencias críticas:
</p>
<ul>
    <li><strong>Saturación del Call Center y Líneas de Soporte:</strong> Los clientes debían realizar múltiples llamadas telefónicas en horario de oficina para consultar la disponibilidad de técnicos o conocer las zonas de cobertura del servicio, generando tiempos de espera superiores a los 20 minutos en horas pico.</li>
    <li><strong>Errores Humanos en la Captura y Registro de Citas:</strong> La recepción telefónica de datos como la dirección del inmueble, el tipo de mantenimiento y el número de contacto solía registrarse manualmente en cuadernos o planillas aisladas, ocasionando duplicidad de agendamientos y visitas fallidas por direcciones incompletas.</li>
    <li><strong>Dependencia Técnica en la Administración de WhatsApp:</strong> Cuando las empresas intentaban utilizar cuentas de WhatsApp corporativo, ante cualquier reinicio del celular de la empresa o vencimiento de la sesión, el personal administrativo quedaba bloqueado y dependía de llamadas urgentes a programadores externos para reconfigurar o escanear el código QR.</li>
</ul>

<h2>1.2 Diagrama Visual de Actores e Interesados (UML Stakeholders con Actores Dibujados)</h2>
<p>
A continuación se presenta el diagrama arquitectónico estructural que representa visualmente a los cuatro actores humanos (dibujados mediante estándar UML de actores / muñecos) y su interconexión directa con las capas funcionales del ecosistema <strong>Hidrosys EC.</strong>:
</p>

<div class="diagram-box">
    <svg width="680" height="280" viewBox="0 0 680 280">
        <!-- Muñeco 1: Cliente -->
        {svg_actor(75, 80, "Cliente / Ciudadano", "Canal WhatsApp")}
        
        <!-- Muñeco 2: Super Admin -->
        {svg_actor(75, 215, "Dueño / Super Admin", "Panel Web Principal")}

        <!-- Muñeco 3: Operador Oficina -->
        {svg_actor(605, 80, "Operador Oficina", "Gestión de Citas")}

        <!-- Muñeco 4: Técnico Campo -->
        {svg_actor(605, 215, "Técnico de Campo", "Atención en Sitio")}

        <!-- Caja Central del Sistema -->
        <rect x="180" y="25" width="320" height="230" rx="14" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="340" y="55" font-family="'Outfit', sans-serif" font-size="13" font-weight="800" fill="#002e6e" text-anchor="middle">NÚCLEO TECNOLÓGICO HIDROSYS EC.</text>

        <!-- Bloque Interno 1: Bot -->
        <rect x="205" y="75" width="270" height="42" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="340" y="100" font-size="10.5" font-weight="700" fill="#1e40af" text-anchor="middle">Asistente Virtual WhatsApp Bot (Baileys)</text>

        <!-- Bloque Interno 2: Panel Web QR -->
        <rect x="205" y="130" width="270" height="42" rx="8" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="340" y="155" font-size="10.5" font-weight="700" fill="#065f46" text-anchor="middle">Panel Web: Pestaña "Escanear QR" en Vivo</text>

        <!-- Bloque Interno 3: Motor DB -->
        <rect x="205" y="185" width="270" height="42" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="340" y="210" font-size="10.5" font-weight="700" fill="#92400e" text-anchor="middle">Base de Datos & Seguridad requireAuth</text>

        <!-- Líneas de interconexión -->
        <line x1="115" y1="80" x2="205" y2="95" stroke="#334155" stroke-width="2"/>
        <line x1="115" y1="215" x2="205" y2="150" stroke="#334155" stroke-width="2"/>
        <line x1="115" y1="215" x2="205" y2="205" stroke="#334155" stroke-width="2"/>
        <line x1="565" y1="80" x2="475" y2="150" stroke="#334155" stroke-width="2"/>
        <line x1="565" y1="215" x2="475" y2="205" stroke="#334155" stroke-width="2"/>
    </svg>
    <div class="diagram-caption">Figura 1.1 - Mapa Estructural de Actores e Interrelación Operativa en Hidrosys EC.</div>
</div>

<div class="explanation-box">
    <strong>Explicación Técnica y Humanizada del Diagrama 1.1:</strong><br>
    El diagrama ilustra claramente la separación de responsabilidades y los puntos de acceso al sistema:
    <ul>
        <li><strong>El Cliente (Izquierda Superior):</strong> Interactúa de manera exclusiva a través del canal de mensajería universal WhatsApp. No necesita instalar aplicaciones móviles ni registrar cuentas con contraseñas complejas; simplemente escribe al número corporativo (+593 968245633) y es atendido en milisegundos por el Asistente Virtual.</li>
        <li><strong>El Dueño / Super Administrador (Izquierda Inferior):</strong> Accede a la plataforma web central donde cuenta con la funcionalidad revolucionaria de la pestaña <code>📱 Escanear QR / WhatsApp</code>, otorgándole autonomía absoluta para reconectar y monitorear el estado del servidor.</li>
        <li><strong>El Operador de Oficina (Derecha Superior):</strong> Utiliza el módulo de citas para auditar, confirmar y coordinar las inspecciones agendadas.</li>
        <li><strong>El Técnico de Campo (Derecha Inferior):</strong> Recibe las órdenes de trabajo asignadas y reporta la finalización de los servicios en sitio.</li>
    </ul>
</div>

<h2>1.3 Perfiles de Usuario y Caracterización de Necesidades</h2>
<p>
Para asegurar que el diseño del software responda fielmente a la realidad del trabajo diario, se construyó una caracterización detallada de los cuatro perfiles de usuario identificados en Hidrosys EC.:
</p>

<table>
    <thead>
        <tr>
            <th style="width:20%;">Rol Institucional</th>
            <th style="width:25%;">Problema / Frustración Principal</th>
            <th>Necesidad Concreta de Negocio</th>
            <th>Solución Tecnológica Implementada</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Cliente / Usuario de Agua y Gas</strong></td>
            <td>Dificultad para comunicarse por teléfono, largas esperas en línea y menús interactivos complejos que no cargan en ciertos celulares.</td>
            <td>Contar con un canal de atención inmediato, intuitivo y disponible las 24 horas del día, los 7 días de la semana.</td>
            <td>Asistente WhatsApp con <strong>Menú Numérico Estructurado (1, 2, 3)</strong>, garantizando 100% de confiabilidad sin depender de botones interactivos.</td>
        </tr>
        <tr>
            <td><strong>Dueño / Administrador Principal</strong></td>
            <td>Pérdida de conectividad entre el bot y WhatsApp que obligaba a esperar horas para que un técnico informático intervenga.</td>
            <td>Poder vincular y reconectar el celular corporativo al bot en segundos desde un panel visual intuitivo y protegido.</td>
            <td>Creación de la pestaña <strong>"📱 Escanear QR / WhatsApp"</strong> con sincronización en tiempo real al servidor Baileys y botón de reinicio seguro.</td>
        </tr>
        <tr>
            <td><strong>Administrador Secundario (Oficina)</strong></td>
            <td>Desorden en la agenda manual, conflicto de horarios de técnicos y extravío de direcciones de clientes.</td>
            <td>Disponer de una base de datos centralizada con filtros rápidos por estado de cita (Pendiente, Confirmada, Completada).</td>
            <td>Módulo web de Gestión de Citas con actualización transaccional, asignación de cuadrillas y exportación a reportes.</td>
        </tr>
        <tr>
            <td><strong>Trabajador Técnico en Campo</strong></td>
            <td>Falta de claridad en las especificaciones del servicio a realizar y retrasos en reportar el cumplimiento.</td>
            <td>Recibir datos completos del cliente (Nombre, Dirección exacta, Tipo de Inspección) de forma clara y ordenada.</td>
            <td>Órdenes de trabajo formalizadas en el sistema que notifican el estado de avance en tiempo real al panel administrativo.</td>
        </tr>
    </tbody>
</table>

<h2>1.4 Catálogo Exhaustivo y Matriz de Priorización de Necesidades (MoSCoW)</h2>
<p>
Aplicando la metodología de priorización <strong>MoSCoW</strong> (Must Have, Should Have, Could Have, Won't Have), se jerarquizaron todas las necesidades funcionales y operativas detectadas en la investigación de campo:
</p>

<table>
    <thead>
        <tr>
            <th style="width:12%;">Prioridad</th>
            <th style="width:10%;">Código</th>
            <th style="width:38%;">Necesidad Específica del Sistema</th>
            <th>Justificación e Impacto Operativo en Hidrosys EC.</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><span class="badge-req badge-success">MUST HAVE</span></td>
            <td>NEC-01</td>
            <td>Atención automatizada bidireccional vía WhatsApp sin esperas.</td>
            <td>Es el pilar fundamental del servicio al cliente; elimina el 90% de la carga del Call Center telefónico.</td>
        </tr>
        <tr>
            <td><span class="badge-req badge-success">MUST HAVE</span></td>
            <td>NEC-02</td>
            <td>Menú conversacional basado en números simples (1, 2, 3).</td>
            <td>Asegura que todos los celulares (sin importar marca o versión de WhatsApp) puedan interactuar sin que se bloqueen botones interactivos.</td>
        </tr>
        <tr>
            <td><span class="badge-req badge-success">MUST HAVE</span></td>
            <td>NEC-03</td>
            <td>Captura guiada de datos de citas (Nombre, Dirección, Fecha, Servicio).</td>
            <td>Permite agendar inspecciones formales almacenadas directamente en la base de datos sin intervención manual del personal.</td>
        </tr>
        <tr>
            <td><span class="badge-req badge-success">MUST HAVE</span></td>
            <td>NEC-04</td>
            <td>Pestaña web de administración "📱 Escanear QR / WhatsApp".</td>
            <td>Otorga soberanía e independencia tecnológica al dueño del negocio para reconectar su número de WhatsApp al instante.</td>
        </tr>
        <tr>
            <td><span class="badge-req badge-success">MUST HAVE</span></td>
            <td>NEC-05</td>
            <td>Seguridad y control de acceso mediante tokens (<code>requireAuth</code>).</td>
            <td>Protege los endpoints administrativos y evita que usuarios no autorizados puedan reiniciar servicios o consultar citas de clientes.</td>
        </tr>
        <tr>
            <td><span class="badge-req">SHOULD HAVE</span></td>
            <td>NEC-06</td>
            <td>Módulo web de filtrado y cambio de estados de citas (Pendiente / Confirmada).</td>
            <td>Facilitador administrativo clave para ordenar las órdenes de trabajo por prioridad y fecha de ejecución.</td>
        </tr>
        <tr>
            <td><span class="badge-req">SHOULD HAVE</span></td>
            <td>NEC-07</td>
            <td>Consulta de cobertura territorial para instalaciones de agua y gas.</td>
            <td>Permite al cliente saber de inmediato si su zona o sector cuenta con cobertura técnica habilitada por Hidrosys EC.</td>
        </tr>
        <tr>
            <td><span class="badge-req badge-warning">COULD HAVE</span></td>
            <td>NEC-08</td>
            <td>Exportación consolidada de reportes técnicos en PDF institucional y Excel.</td>
            <td>Permite a la gerencia auditar el volumen semanal y mensual de citas atendidas y servicios completados.</td>
        </tr>
    </tbody>
</table>
"""

# =========================================================================
# DOCUMENTO 2: HISTORIAS DE USUARIO Y METODOLOGÍA ÁGIL (EXHAUSTIVO)
# =========================================================================
DOC2_CONTENT = f"""
<h1>2. ESPECIFICACIÓN DE HISTORIAS DE USUARIO Y METODOLOGÍA ÁGIL SCRUM</h1>
<p>
Para el desarrollo y evolución de <strong>Hidrosys EC.</strong>, se adoptó el marco de trabajo ágil <strong>Scrum</strong>, modelando cada requisito funcional del negocio bajo la forma de <strong>Historias de Usuario</strong>. Este enfoque sitúa a las personas (clientes, administradores y trabajadores) en el centro de las decisiones de ingeniería de software.
</p>

<h2>2.1 Ciclo de Vida Ágil y Criterios de Calidad INVEST</h2>
<p>
Todas las historias de usuario redactadas en este documento cumplen estrictamente con los seis criterios del acrónimo <strong>INVEST</strong>:
</p>
<ul>
    <li><strong>Independiente (I):</strong> Cada historia puede desarrollarse, probarse y entregarse de forma modular sin bloquear a otras.</li>
    <li><strong>Negociable (N):</strong> Los detalles de implementación se refinan conversando entre el equipo de desarrollo y los administradores.</li>
    <li><strong>Valiosa (V):</strong> Aporta un beneficio medible y directo para la atención de clientes o la administración de agua y gas.</li>
    <li><strong>Estimable (E):</strong> Su alcance técnico permite dimensionar el esfuerzo en Puntos de Historia (secuencia de Fibonacci).</li>
    <li><strong>Pequeña (S):</strong> Su tamaño permite implementarse y verificarse dentro de un ciclo o iteración de desarrollo.</li>
    <li><strong>Comprobable (T):</strong> Cuenta con Criterios de Aceptación explícitos que definen inequívocamente cuándo la historia está completada (Definition of Done).</li>
</ul>

<h2>2.2 Diagrama Visual del Flujo de Valor Ágil (UML Scrum Flow)</h2>
<p>
El siguiente esquema ilustra cómo las necesidades del actor usuario se transforman en elementos verificables del Product Backlog y fluyen hasta convertirse en entregas funcionales en producción:
</p>

<div class="diagram-box">
    <svg width="680" height="230" viewBox="0 0 680 230">
        <!-- Muñeco Actor -->
        {svg_actor(70, 95, "Actor Usuario", "Stakeholder")}

        <line x1="110" y1="95" x2="165" y2="95" stroke="#2563eb" stroke-width="2.5"/>

        <!-- Caja Backlog -->
        <rect x="165" y="45" width="135" height="100" rx="10" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
        <text x="232" y="75" font-size="11.5" font-weight="bold" fill="#1e40af" text-anchor="middle">Product Backlog</text>
        <text x="232" y="98" font-size="9.5" fill="#1e40af" text-anchor="middle">• HU-01 Menú WhatsApp</text>
        <text x="232" y="118" font-size="9.5" fill="#1e40af" text-anchor="middle">• HU-02 Agendamiento</text>
        <text x="232" y="135" font-size="9.5" fill="#1e40af" text-anchor="middle">• HU-03 Pestaña QR Web</text>

        <line x1="300" y1="95" x2="355" y2="95" stroke="#2563eb" stroke-width="2.5"/>

        <!-- Caja Sprint -->
        <rect x="355" y="45" width="145" height="100" rx="35" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
        <text x="427" y="75" font-size="11.5" font-weight="bold" fill="#92400e" text-anchor="middle">Sprint Iterativo</text>
        <text x="427" y="98" font-size="9.5" fill="#92400e" text-anchor="middle">Desarrollo Node.js</text>
        <text x="427" y="118" font-size="9.5" fill="#92400e" text-anchor="middle">Integración Baileys</text>
        <text x="427" y="135" font-size="9.5" fill="#92400e" text-anchor="middle">Pruebas Unitarias</text>

        <line x1="500" y1="95" x2="555" y2="95" stroke="#10b981" stroke-width="2.5"/>

        <!-- Caja Incremento -->
        <rect x="555" y="45" width="115" height="100" rx="10" fill="#d1fae5" stroke="#065f46" stroke-width="2"/>
        <text x="612" y="78" font-size="11.5" font-weight="bold" fill="#065f46" text-anchor="middle">Entrega Final</text>
        <text x="612" y="105" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">Hidrosys EC. v3.0</text>
        <text x="612" y="125" font-size="8.5" fill="#065f46" text-anchor="middle">En Producción</text>
    </svg>
    <div class="diagram-caption">Figura 2.1 - Trazabilidad y Flujo Ágil de Implementación de Historias de Usuario</div>
</div>

<h2>2.3 Fichas Técnicas Detalladas de Historias de Usuario</h2>

<div class="card">
    <div class="card-title">HU-01: Interacción por WhatsApp con Menú Numérico 100% Confiable</div>
    <p><strong>Código:</strong> HU-01 &nbsp;|&nbsp; <strong>Rol:</strong> Cliente de Agua y Gas &nbsp;|&nbsp; <strong>Puntos de Historia:</strong> 3 pt &nbsp;|&nbsp; <strong>Iteración:</strong> Sprint 1</p>
    <p><strong>Como</strong> cliente que busca atención o asesoría en Hidrosys EC.,<br>
    <strong>Quiero</strong> enviar un mensaje a WhatsApp y recibir un menú estructurado con opciones numeradas en texto plano (ejemplo: 1, 2, 3),<br>
    <strong>Para</strong> poder seleccionar el servicio que necesito rápidamente desde cualquier teléfono sin sufrir errores ni bloqueos por incompatibilidad de botones flotantes.</p>
    <p><strong>Justificación Humanizada:</strong> Durante las pruebas iniciales, los botones interactivos oficiales de Meta fallaban en celulares Android antiguos o cuentas no empresariales. La transición a un menú numérico limpio en texto garantizó que el 100% de los ciudadanos ecuatorianos puedan navegar por el bot sin interrupciones.</p>
    <p><strong>Criterios de Aceptación Verificados:</strong></p>
    <ol>
        <li>Al escribir saludos iniciales ("Hola", "Buen día", "Soporte"), el bot debe responder en menos de 1.5 segundos desplegando el encabezado oficial de Hidrosys EC. y las opciones numeradas.</li>
        <li>Si el cliente envía el número '1', el sistema debe iniciar inmediatamente el flujo de agendamiento de cita técnica.</li>
        <li>Si el cliente envía el número '2', el sistema debe desplegar la información de zonas de cobertura y horarios de atención.</li>
        <li>Si el cliente ingresa un texto no numérico o un número fuera de rango en el menú principal, el bot emitirá una orientación amable recordando cómo seleccionar las opciones correctas.</li>
    </ol>
</div>

<div class="card">
    <div class="card-title">HU-02: Agendamiento Guiado y Automatizado de Citas e Inspecciones</div>
    <p><strong>Código:</strong> HU-02 &nbsp;|&nbsp; <strong>Rol:</strong> Cliente / Usuario Final &nbsp;|&nbsp; <strong>Puntos de Historia:</strong> 5 pt &nbsp;|&nbsp; <strong>Iteración:</strong> Sprint 1</p>
    <p><strong>Como</strong> ciudadano o empresa que requiere una inspección de agua potable o gas,<br>
    <strong>Quiero</strong> que el bot de WhatsApp me solicite paso a paso mis datos de contacto e inmueble,<br>
    <strong>Para</strong> coordinar de forma oficial una visita técnica sin tener que acudir presencialmente a oficinas.</p>
    <p><strong>Criterios de Aceptación Verificados:</strong></p>
    <ol>
        <li>El bot solicitará de forma secuencial: Nombre Completo, Dirección Exacta del inmueble, Tipo de Servicio y Horario Preferido.</li>
        <li>Una vez proporcionados los datos, el backend procesará y almacenará la orden de trabajo en la tabla de base de datos con estado <code>Pendiente</code>.</li>
        <li>El bot enviará un comprobante formal de agendamiento con resumen de los datos y mensaje de confirmación.</li>
    </ol>
</div>

<div class="card">
    <div class="card-title">HU-03: Reconexión Autónoma en Panel Web - Pestaña "📱 Escanear QR / WhatsApp"</div>
    <p><strong>Código:</strong> HU-03 &nbsp;|&nbsp; <strong>Rol:</strong> Dueño / Administrador Principal &nbsp;|&nbsp; <strong>Puntos de Historia:</strong> 8 pt &nbsp;|&nbsp; <strong>Iteración:</strong> Sprint 2</p>
    <p><strong>Como</strong> dueño o administrador principal del sistema Hidrosys EC.,<br>
    <strong>Quiero</strong> disponer de una pestaña en mi menú web de administración que muestre el estado en vivo de WhatsApp y renderice el código QR en pantalla,<br>
    <strong>Para</strong> escanearlo directamente desde mi celular corporativo y conectar el bot al instante en caso de pérdida de conexión sin necesitar ayuda externa.</p>
    <p><strong>Justificación Humanizada:</strong> Esta característica otorga verdadera independencia al dueño del negocio. Si el teléfono se apaga o WhatsApp se actualiza, el dueño entra a su panel web y soluciona la conexión en menos de 4 segundos.</p>
    <p><strong>Criterios de Aceptación Verificados:</strong></p>
    <ol>
        <li>El panel web en <code>http://localhost:3000</code> debe incorporar en el menú lateral la opción <strong>"📱 Escanear QR / WhatsApp"</strong>.</li>
        <li>La interfaz consulta periódicamente al endpoint <code>/api/wa/status</code> para conocer si la sesión de Baileys está conectada o requiere vinculación.</li>
        <li>Si el bot está conectado, la pantalla muestra una tarjeta verde con la notificación <strong>"¡Dispositivo Conectado! ✅"</strong> y el número telefónico enlazado.</li>
        <li>Si la sesión se desconecta, el sistema renderiza en pantalla un código QR nítido listo para ser escaneado con la cámara de WhatsApp móvil.</li>
        <li>Se incluye un botón protegido por autenticación: <strong>"🔄 Reiniciar Conexión / Generar Nuevo QR"</strong> que renueva la sesión al instante.</li>
    </ol>
</div>

<div class="card">
    <div class="card-title">HU-04: Seguridad Institucional en Endpoints mediante requireAuth</div>
    <p><strong>Código:</strong> HU-04 &nbsp;|&nbsp; <strong>Rol:</strong> Administrador del Sistema &nbsp;|&nbsp; <strong>Puntos de Historia:</strong> 5 pt &nbsp;|&nbsp; <strong>Iteración:</strong> Sprint 2</p>
    <p><strong>Como</strong> responsable de la seguridad de datos de Hidrosys EC.,<br>
    <strong>Quiero</strong> que todas las peticiones administrativas a la API REST verifiquen la presencia de un token de sesión,<br>
    <strong>Para</strong> impedir que atacantes externos o solicitudes no verificadas puedan reiniciar el bot o manipular citas de clientes.</p>
    <p><strong>Criterios de Aceptación Verificados:</strong></p>
    <ol>
        <li>El middleware <code>requireAuth</code> de Express inspecciona el encabezado HTTP <code>x-session-token</code> en cada petición sensible.</li>
        <li>Si el token es inválido o la sesión expiró, el servidor rechaza la orden respondiendo con código HTTP 401 Unauthorized.</li>
    </ol>
</div>

<h2>2.4 Resumen Consolidado del Product Backlog</h2>
<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Título de la Historia</th>
            <th>Actor Principal</th>
            <th>Esfuerzo (Fibonacci)</th>
            <th>Estado de Implementación</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>HU-01</td>
            <td>Navegación con Menú Numérico 100% Confiable</td>
            <td>Cliente / Usuario</td>
            <td>3 pt</td>
            <td>Completada y Verificada</td>
        </tr>
        <tr>
            <td>HU-02</td>
            <td>Agendamiento Conversacional Paso a Paso</td>
            <td>Cliente / Usuario</td>
            <td>5 pt</td>
            <td>Completada y Verificada</td>
        </tr>
        <tr>
            <td>HU-03</td>
            <td>Pestaña Web de Administración y Reconexión QR</td>
            <td>Dueño / Super Admin</td>
            <td>8 pt</td>
            <td>Completada y Verificada</td>
        </tr>
        <tr>
            <td>HU-04</td>
            <td>Protección de Rutas con Middleware requireAuth</td>
            <td>Administrador del Sistema</td>
            <td>5 pt</td>
            <td>Completada y Verificada</td>
        </tr>
        <tr>
            <td>HU-05</td>
            <td>Consulta Instantánea de Coberturas de Agua y Gas</td>
            <td>Cliente / Usuario</td>
            <td>3 pt</td>
            <td>Completada y Verificada</td>
        </tr>
        <tr>
            <td>HU-06</td>
            <td>Gestión de Citas (Confirmación / Asignación)</td>
            <td>Administrador Secundario</td>
            <td>5 pt</td>
            <td>Completada y Verificada</td>
        </tr>
    </tbody>
</table>
"""

# =========================================================================
# DOCUMENTO 3: CASOS DE USO CERO Y DETALLADOS (CON MUÑECOS UML OFICIALES)
# =========================================================================
DOC3_CONTENT = f"""
<h1>3. ARQUITECTURA CONDUCTUAL: CASOS DE USO CERO Y CASOS DETALLADOS</h1>
<p>
El análisis de Casos de Uso constituye el modelado formal de las interacciones externas e internas que ocurren dentro del ecosistema tecnológico <strong>Hidrosys EC.</strong>. En este capítulo se presenta el <strong>Diagrama de Casos de Uso Cero (Nivel Contextual y Frontera Global)</strong> con la diagramación canónica de actores UML (muñecos), complementado con los diagramas de detalle y fichas operativas para cada rol institucional.
</p>

<h2>3.1 Diagrama de Casos de Uso Cero (Vista de Frontera Global con Muñecos UML)</h2>
<p>
El diagrama 3.1 plasma la totalidad de fronteras de la plataforma, mostrando a los cuatro actores interactuando con los macro-casos de uso que encapsulan la lógica en Node.js, Express y Baileys:
</p>

<div class="diagram-box">
    <svg width="680" height="380" viewBox="0 0 680 380">
        <!-- Muñeco 1: Cliente WhatsApp -->
        {svg_actor(70, 95, "Cliente WhatsApp", "Actor Externo")}

        <!-- Muñeco 2: Administrador Principal -->
        {svg_actor(70, 265, "Super Admin", "Dueño Empresa")}

        <!-- Muñeco 3: Administrador Secundario -->
        {svg_actor(610, 95, "Operador Oficina", "Admin Secundario")}

        <!-- Muñeco 4: Trabajador Técnico -->
        {svg_actor(610, 265, "Técnico Campo", "Personal Cuadrilla")}

        <!-- Caja Frontera del Sistema -->
        <rect x="155" y="20" width="370" height="345" rx="16" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="340" y="50" font-family="'Outfit', sans-serif" font-size="13" font-weight="800" fill="#002e6e" text-anchor="middle">FRONTERA DEL SISTEMA HIDROSYS EC.</text>

        <!-- Elipse 1: Interacción por Menú Numérico -->
        <ellipse cx="340" cy="95" rx="140" ry="24" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="340" y="99" font-size="10.5" font-weight="700" fill="#1e40af" text-anchor="middle">UC-01: Conversar por Menú Numérico y Citas</text>

        <!-- Elipse 2: Reconexión QR en Vivo -->
        <ellipse cx="340" cy="160" rx="140" ry="24" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="340" y="164" font-size="10.5" font-weight="700" fill="#065f46" text-anchor="middle">UC-02: Escanear QR y Vincular WhatsApp Web</text>

        <!-- Elipse 3: Gestión de Órdenes y Asignación -->
        <ellipse cx="340" cy="225" rx="140" ry="24" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="340" y="229" font-size="10.5" font-weight="700" fill="#92400e" text-anchor="middle">UC-03: Administrar Citas y Asignar Cuadrillas</text>

        <!-- Elipse 4: Seguridad y Cierre en Campo -->
        <ellipse cx="340" cy="290" rx="140" ry="24" fill="#f3e8ff" stroke="#7e22ce" stroke-width="1.5"/>
        <text x="340" y="294" font-size="10.5" font-weight="700" fill="#6b21a8" text-anchor="middle">UC-04: Auditar Seguridad y Ejecutar Campo</text>

        <!-- Conexiones Actor - Caso de Uso -->
        <line x1="105" y1="95" x2="200" y2="95" stroke="#334155" stroke-width="2"/>
        <line x1="105" y1="265" x2="200" y2="160" stroke="#334155" stroke-width="2"/>
        <line x1="105" y1="265" x2="200" y2="290" stroke="#334155" stroke-width="2"/>
        <line x1="575" y1="95" x2="480" y2="225" stroke="#334155" stroke-width="2"/>
        <line x1="575" y1="265" x2="480" y2="290" stroke="#334155" stroke-width="2"/>
    </svg>
    <div class="diagram-caption">Figura 3.1 - Diagrama UML de Casos de Uso Cero (Arquitectura de Frontera del Sistema)</div>
</div>

<div class="explanation-box">
    <strong>Análisis del Diagrama de Casos de Uso Cero:</strong><br>
    El diagrama muestra la independencia operativa del sistema y delimita perfectamente las competencias funcionales:
    <ul>
        <li><strong>UC-01 (Atención al Cliente vía WhatsApp):</strong> Es disparado por el actor <em>Cliente WhatsApp</em>. Gestiona el diálogo inicial y el registro en la base de datos sin fricción.</li>
        <li><strong>UC-02 (Reconexión y Escaneo QR):</strong> Es operado por el <em>Super Administrador</em> a través del panel web, resolviendo la reconexión de Baileys al instante.</li>
        <li><strong>UC-03 y UC-04 (Administración Operativa):</strong> Coordinan las citas y las órdenes técnicas entre la oficina y las cuadrillas en terreno.</li>
    </ul>
</div>

<h2>3.2 Casos de Uso Detallados por Rol Institucional</h2>

<h3>3.2.1 Rol: Administrador Principal (Super Admin) - Diagrama y Fichas</h3>

<div class="diagram-box">
    <svg width="640" height="170" viewBox="0 0 640 170">
        {svg_actor(75, 85, "Super Admin", "Rol Principal")}
        <rect x="195" y="20" width="410" height="130" rx="12" fill="#f8fafc" stroke="#002e6e" stroke-width="2"/>
        <ellipse cx="400" cy="60" rx="160" ry="22" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="400" y="64" font-size="10.5" font-weight="700" fill="#065f46" text-anchor="middle">CUD-01: Escanear QR y Monitorear Bot en Vivo</text>
        <ellipse cx="400" cy="115" rx="160" ry="22" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="400" y="119" font-size="10.5" font-weight="700" fill="#1e40af" text-anchor="middle">CUD-02: Control de Sesiones con requireAuth</text>
        <line x1="110" y1="85" x2="240" y2="60" stroke="#334155" stroke-width="2"/>
        <line x1="110" y1="85" x2="240" y2="115" stroke="#334155" stroke-width="2"/>
    </svg>
    <div class="diagram-caption">Figura 3.2 - Casos de Uso Específicos del Rol Administrador Principal</div>
</div>

<table>
    <thead>
        <tr>
            <th style="width:25%;">Atributo Formal</th>
            <th>Especificación y Flujo Transaccional</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Identificador y Nombre</strong></td>
            <td><strong>CUD-01: Sincronización en Tiempo Real de WhatsApp mediante Pestaña "Escanear QR"</strong></td>
        </tr>
        <tr>
            <td><strong>Actor Principal</strong></td>
            <td>Dueño de la Empresa / Administrador Principal</td>
        </tr>
        <tr>
            <td><strong>Precondición</strong></td>
            <td>El usuario inició sesión como administrador en <code>http://localhost:3000</code> y cuenta con un token <code>x-session-token</code> válido.</td>
        </tr>
        <tr>
            <td><strong>Flujo Principal (Éxito)</strong></td>
            <td>
                1. El administrador hace clic en la opción lateral <strong>📱 Escanear QR / WhatsApp</strong>.<br>
                2. El sistema web invoca el endpoint <code>GET /api/wa/status</code> del backend Node.js.<br>
                3. Si el estado de Baileys reporta desconexión, el servidor retorna el string base64 del código QR fresco.<br>
                4. El administrador abre WhatsApp en el celular corporativo y escanea el código en pantalla.<br>
                5. El servidor confirma la autenticación criptográfica de WhatsApp y cambia el indicador visual a <strong>¡Dispositivo Conectado! ✅</strong>.
            </td>
        </tr>
        <tr>
            <td><strong>Postcondición</strong></td>
            <td>El bot conversacional de Hidrosys EC. entra en estado operativo activo para todos los clientes en Ecuador.</td>
        </tr>
    </tbody>
</table>

<h3>3.2.2 Rol: Administrador Secundario (Operador de Oficina)</h3>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Atributo Formal</th>
            <th>Especificación y Flujo Transaccional</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Identificador y Nombre</strong></td>
            <td><strong>CUD-03: Coordinación y Confirmación de Citas de Agua y Gas</strong></td>
        </tr>
        <tr>
            <td><strong>Actor Principal</strong></td>
            <td>Administrador Secundario / Operador de Atención</td>
        </tr>
        <tr>
            <td><strong>Flujo Principal</strong></td>
            <td>
                1. El operador ingresa a la sección <strong>📅 Gestión de Citas</strong>.<br>
                2. Selecciona la pestaña de filtro por citas en estado <code>Pendiente</code> generadas vía WhatsApp.<br>
                3. Verifica la dirección del inmueble y asigna una cuadrilla de técnicos disponible.<br>
                4. Cambia el estado de la cita a <code>Confirmada</code> y guarda los cambios en base de datos.
            </td>
        </tr>
    </tbody>
</table>
"""

# =========================================================================
# DOCUMENTO 4: CASOS DE USO DE CONTEXTO Y ARQUITECTURA DE FRONTERA
# =========================================================================
DOC4_CONTENT = f"""
<h1>4. CASOS DE USO DE CONTEXTO Y ARQUITECTURA DE FRONTERA</h1>
<p>
El análisis arquitectónico de contexto define con total precisión científica las fronteras físicas, los protocolos de red y las capas de comunicación que separan al sistema <strong>Hidrosys EC.</strong> del mundo exterior.
</p>

<h2>4.1 Diagrama de Arquitectura de Contexto y Capas del Ecosistema</h2>
<div class="diagram-box">
    <svg width="680" height="240" viewBox="0 0 680 240">
        <!-- Capa Exterior: Móviles -->
        <rect x="25" y="65" width="140" height="95" rx="10" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
        <text x="95" y="100" font-size="11.5" font-weight="bold" fill="#1e40af" text-anchor="middle">WhatsApp App</text>
        <text x="95" y="122" font-size="9" fill="#1e40af" text-anchor="middle">(Clientes Android/iOS)</text>
        <text x="95" y="140" font-size="8.5" font-weight="bold" fill="#2563eb" text-anchor="middle">+593 968245633</text>

        <!-- Flecha de Conexión 1 -->
        <line x1="165" y1="112" x2="235" y2="112" stroke="#334155" stroke-width="2.5"/>
        <text x="200" y="102" font-size="8.5" font-weight="bold" fill="#64748b" text-anchor="middle">WebSocket</text>

        <!-- Capa Servidor Node.js -->
        <rect x="235" y="30" width="230" height="175" rx="14" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="350" y="60" font-size="12.5" font-weight="800" fill="#002e6e" text-anchor="middle">BACKEND NODE.JS HIDROSYS</text>
        
        <rect x="255" y="75" width="190" height="36" rx="6" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="350" y="98" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">Baileys WebSocket Service</text>

        <rect x="255" y="120" width="190" height="36" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="350" y="143" font-size="10" font-weight="bold" fill="#92400e" text-anchor="middle">Express API & requireAuth</text>

        <rect x="255" y="165" width="190" height="28" rx="6" fill="#f3e8ff" stroke="#7e22ce" stroke-width="1.5"/>
        <text x="350" y="184" font-size="9.5" font-weight="bold" fill="#6b21a8" text-anchor="middle">Motor de Flujos WhatsApp</text>

        <!-- Flecha de Conexión 2 -->
        <line x1="465" y1="112" x2="535" y2="112" stroke="#334155" stroke-width="2.5"/>

        <!-- Capa Persistencia y Panel -->
        <rect x="535" y="65" width="125" height="95" rx="10" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
        <text x="597" y="100" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle">Base de Datos</text>
        <text x="597" y="122" font-size="9" fill="#475569" text-anchor="middle">PostgreSQL / SQLite</text>
        <text x="597" y="142" font-size="9" font-weight="bold" fill="#2563eb" text-anchor="middle">Panel Web 3000</text>
    </svg>
    <div class="diagram-caption">Figura 4.1 - Diagrama Arquitectónico de Contexto e Interfaces Externas</div>
</div>

<h2>4.2 Especificación de Protocolos e Interfaces de Entrada/Salida</h2>
<table>
    <thead>
        <tr>
            <th>Interfaz / Protocolo</th>
            <th>Capa Origen</th>
            <th>Capa Destino</th>
            <th>Descripción Técnica del Protocolo</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>WhatsApp Protocol (Baileys WS)</strong></td>
            <td>Servidores Meta WhatsApp</td>
            <td>Backend Express Node.js</td>
            <td>Enlace TCP/WebSocket cifrado de extremo a extremo que canaliza eventos de mensajes en tiempo real.</td>
        </tr>
        <tr>
            <td><strong>REST API Segura (x-session-token)</strong></td>
            <td>Panel Web de Administración</td>
            <td>Express API Server</td>
            <td>Peticiones HTTP/HTTPS protegidas por el middleware <code>requireAuth</code> para operaciones CRUD y reinicio de bot.</td>
        </tr>
        <tr>
            <td><strong>Conector SQL Transaccional</strong></td>
            <td>Servidor Node.js</td>
            <td>Motor PostgreSQL / SQLite</td>
            <td>Persistencia relacional de citas de clientes, usuarios administradores y metadatos de configuración.</td>
        </tr>
    </tbody>
</table>
"""

# =========================================================================
# DOCUMENTO 5: CASOS DE USO DE ESCENARIO (CON DIAGRAMAS DE SECUENCIA)
# =========================================================================
DOC5_CONTENT = f"""
<h1>5. CASOS DE USO DE ESCENARIO (DIAGRAMAS DE SECUENCIA OPERATIVA)</h1>
<p>
Los escenarios operativos detallan cronológicamente las secuencias paso a paso en situaciones reales de uso de <strong>Hidrosys EC.</strong>, contemplando el Flujo Normal (Happy Path), flujos alternativos y flujos de excepción.
</p>

<h2>5.1 Diagrama de Secuencia: Escenario 1 - Agendamiento Exitoso en WhatsApp</h2>
<div class="diagram-box">
    <svg width="660" height="240" viewBox="0 0 660 240">
        <!-- Nodos superiores -->
        <rect x="30" y="20" width="115" height="36" rx="6" fill="#002e6e"/>
        <text x="87" y="43" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Cliente WhatsApp</text>
        <line x1="87" y1="56" x2="87" y2="220" stroke="#64748b" stroke-dasharray="4"/>

        <rect x="195" y="20" width="125" height="36" rx="6" fill="#2563eb"/>
        <text x="257" y="43" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Bot Hidrosys EC.</text>
        <line x1="257" y1="56" x2="257" y2="220" stroke="#64748b" stroke-dasharray="4"/>

        <rect x="370" y="20" width="125" height="36" rx="6" fill="#10b981"/>
        <text x="432" y="43" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Servidor Express</text>
        <line x1="432" y1="56" x2="432" y2="220" stroke="#64748b" stroke-dasharray="4"/>

        <rect x="525" y="20" width="110" height="36" rx="6" fill="#7e22ce"/>
        <text x="580" y="43" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Base de Datos</text>
        <line x1="580" y1="56" x2="580" y2="220" stroke="#64748b" stroke-dasharray="4"/>

        <!-- Interacciones -->
        <line x1="87" y1="85" x2="257" y2="85" stroke="#002e6e" stroke-width="2"/>
        <text x="172" y="78" font-size="9" fill="#002e6e" text-anchor="middle">1. Escribe "Hola" -> Opción '1'</text>

        <line x1="257" y1="125" x2="432" y2="125" stroke="#2563eb" stroke-width="2"/>
        <text x="345" y="118" font-size="9" fill="#2563eb" text-anchor="middle">2. Envía Datos de Cita</text>

        <line x1="432" y1="165" x2="580" y2="165" stroke="#10b981" stroke-width="2"/>
        <text x="506" y="158" font-size="9" font-weight="bold" fill="#065f46" text-anchor="middle">3. INSERT Cita (Pendiente)</text>

        <line x1="432" y1="200" x2="87" y2="200" stroke="#002e6e" stroke-width="2"/>
        <text x="260" y="193" font-size="9.5" font-weight="bold" fill="#002e6e" text-anchor="middle">4. Confirmación por Chat: Cita Agendada Exitosamente ✅</text>
    </svg>
    <div class="diagram-caption">Figura 5.1 - Cronograma de Intercambio de Mensajes en el Agendamiento</div>
</div>

<h2>5.2 Escenario 2: Reconexión Autónoma en Pestaña "📱 Escanear QR / WhatsApp"</h2>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Paso Operativo</th>
            <th>Acción del Actor (Dueño / Admin)</th>
            <th>Respuesta del Servidor y Panel Web</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Paso 1: Acceso</strong></td>
            <td>Ingresa a su panel en <code>http://localhost:3000</code> y pulsa en la pestaña lateral <strong>Escanear QR / WhatsApp</strong>.</td>
            <td>El frontend solicita el estado real al servidor en <code>GET /api/wa/status</code>.</td>
        </tr>
        <tr>
            <td><strong>Paso 2: Diagnóstico</strong></td>
            <td>Observa que el sistema reporta estado temporal <em>Desconectado</em>.</td>
            <td>El servidor envía el código QR fresco en base64 y el panel lo dibuja en pantalla.</td>
        </tr>
        <tr>
            <td><strong>Paso 3: Escaneo</strong></td>
            <td>Abre WhatsApp en el celular corporativo y apunta la cámara al QR de su pantalla.</td>
            <td>Baileys sincroniza en 3 segundos y el panel web cambia a <strong>"¡Dispositivo Conectado! ✅"</strong>.</td>
        </tr>
    </tbody>
</table>
"""

# =========================================================================
# DOCUMENTO 6: REQUISITOS FUNCIONALES Y NO FUNCIONALES (CATÁLOGO COMPLETO)
# =========================================================================
DOC6_CONTENT = f"""
<h1>6. CATÁLOGO EXHAUSTIVO DE REQUISITOS FUNCIONALES Y NO FUNCIONALES</h1>
<p>
Este capítulo contiene la especificación formal de ingeniería de requerimientos de <strong>Hidrosys EC.</strong>, articulando los requisitos funcionales (RF) del software y los requisitos no funcionales (RNF) de calidad, rendimiento y seguridad.
</p>

<h2>6.1 Diagrama de Arquitectura y Trazabilidad de Requisitos</h2>
<div class="diagram-box">
    <svg width="660" height="180" viewBox="0 0 660 180">
        <rect x="30" y="35" width="180" height="105" rx="10" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
        <text x="120" y="65" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">MÓDULO WHATSAPP BOT</text>
        <text x="120" y="90" font-size="9.5" fill="#1e40af" text-anchor="middle">• RF-01 Menú Numérico 1,2,3</text>
        <text x="120" y="110" font-size="9.5" fill="#1e40af" text-anchor="middle">• RF-02 Citas Automáticas</text>
        <text x="120" y="128" font-size="9.5" fill="#1e40af" text-anchor="middle">• RNF-03 100% Compatible</text>

        <rect x="240" y="35" width="180" height="105" rx="10" fill="#d1fae5" stroke="#065f46" stroke-width="2"/>
        <text x="330" y="65" font-size="11" font-weight="bold" fill="#065f46" text-anchor="middle">PANEL WEB ADMIN</text>
        <text x="330" y="90" font-size="9.5" fill="#065f46" text-anchor="middle">• RF-03 Pestaña Escanear QR</text>
        <text x="330" y="110" font-size="9.5" fill="#065f46" text-anchor="middle">• RF-05 CRUD de Citas</text>
        <text x="330" y="128" font-size="9.5" fill="#065f46" text-anchor="middle">• RF-07 Exportar PDF/Excel</text>

        <rect x="450" y="35" width="180" height="105" rx="10" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
        <text x="540" y="65" font-size="11" font-weight="bold" fill="#92400e" text-anchor="middle">SEGURIDAD & RENDIMIENTO</text>
        <text x="540" y="90" font-size="9.5" fill="#92400e" text-anchor="middle">• RF-04 requireAuth Token</text>
        <text x="540" y="110" font-size="9.5" fill="#92400e" text-anchor="middle">• RNF-01 Diseño Premium</text>
        <text x="540" y="128" font-size="9.5" fill="#92400e" text-anchor="middle">• RNF-02 Latencia &lt; 250ms</text>
    </svg>
    <div class="diagram-caption">Figura 6.1 - Mapa Conceptual de Trazabilidad entre Requerimientos y Módulos</div>
</div>

<h2>6.2 Catálogo Formal de Requisitos Funcionales (RF)</h2>
<table>
    <thead>
        <tr>
            <th style="width:12%;">ID</th>
            <th style="width:20%;">Módulo</th>
            <th>Descripción Técnica Exhaustiva del Requisito</th>
            <th style="width:12%;">Prioridad</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>RF-01</strong></td>
            <td>Bot WhatsApp</td>
            <td>El sistema debe desplegar un menú de bienvenida estructurado con opciones numeradas en texto plano ('1', '2', '3'), evitando botones interactivos para asegurar 100% de compatibilidad.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-02</strong></td>
            <td>Agendamiento</td>
            <td>El bot debe procesar de forma secuencial los datos de la cita (Nombre, Dirección, Fecha y Servicio) y guardarlos transaccionalmente en la base de datos.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-03</strong></td>
            <td>Panel Web (QR)</td>
            <td>El panel web debe contar con la pestaña lateral <code>📱 Escanear QR / WhatsApp</code> para consultar y mostrar el código QR en vivo del servidor Baileys.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-04</strong></td>
            <td>Seguridad API</td>
            <td>El middleware de Express <code>requireAuth</code> debe verificar el encabezado HTTP <code>x-session-token</code> ante toda operación administrativa sensible.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-05</strong></td>
            <td>Gestión de Citas</td>
            <td>El administrador debe poder listar, filtrar, modificar y cambiar el estado de las órdenes técnicas en el panel web.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-06</strong></td>
            <td>Reinicio Bot</td>
            <td>El panel debe incluir un botón seguro para reiniciar el servicio de WhatsApp y generar un nuevo QR en caso de pérdida de sesión.</td>
            <td>Media</td>
        </tr>
    </tbody>
</table>

<h2>6.3 Requisitos No Funcionales (RNF)</h2>
<table>
    <thead>
        <tr>
            <th style="width:12%;">ID</th>
            <th style="width:22%;">Categoría</th>
            <th>Estándar de Calidad y Métrica de Ingeniería</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>RNF-01</strong></td>
            <td>Usabilidad UI/UX</td>
            <td>La interfaz del panel web debe cumplir con estándares modernos de diseño premium, tipografía Inter/Outfit y diseño altamente adaptable (responsive).</td>
        </tr>
        <tr>
            <td><strong>RNF-02</strong></td>
            <td>Rendimiento</td>
            <td>El tiempo promedio de respuesta del servidor API ante los comandos del bot de WhatsApp no superará los 250 milisegundos.</td>
        </tr>
        <tr>
            <td><strong>RNF-03</strong></td>
            <td>Confiabilidad</td>
            <td>El servicio del bot debe operar el 99.8% del tiempo, y permitir reconexión visual inmediata en caso de reinicio del móvil.</td>
        </tr>
        <tr>
            <td><strong>RNF-04</strong></td>
            <td>Seguridad</td>
            <td>Las sesiones de administración deben expirar y protegerse contra accesos no autorizados mediante aislamiento de tokens.</td>
        </tr>
    </tbody>
</table>
"""

# =========================================================================
# DOCUMENTO 7: DIAGRAMAS DE ACTIVIDADES Y FLUJOS DE PROCESOS (BPMN)
# =========================================================================
DOC7_CONTENT = f"""
<h1>7. DIAGRAMAS DE ACTIVIDADES Y FLUJOGRAMAS DE PROCESO (BPMN)</h1>
<p>
Los diagramas de actividades ilustran los caminos lógicos, las bifurcaciones condicionales y los flujos de control interno del sistema <strong>Hidrosys EC.</strong>.
</p>

<h2>7.1 Flujograma BPMN: Sincronización QR en Pestaña de Administración</h2>
<div class="diagram-box">
    <svg width="660" height="280" viewBox="0 0 660 280">
        <!-- Inicio -->
        <circle cx="330" cy="22" r="12" fill="#002e6e"/>
        <line x1="330" y1="34" x2="330" y2="55" stroke="#334155" stroke-width="2"/>

        <rect x="175" y="55" width="310" height="38" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="330" y="78" font-size="10.5" font-weight="bold" fill="#1e40af" text-anchor="middle">1. Administrador abre pestaña "📱 Escanear QR"</text>
        <line x1="330" y1="93" x2="330" y2="115" stroke="#334155" stroke-width="2"/>

        <!-- Rombo -->
        <polygon points="330,115 410,150 330,185 250,150" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="330" y="154" font-size="10" font-weight="bold" fill="#92400e" text-anchor="middle">¿Sesión Conectada?</text>

        <!-- Rama SI -->
        <line x1="410" y1="150" x2="495" y2="150" stroke="#10b981" stroke-width="2.5"/>
        <text x="450" y="142" font-size="9.5" font-weight="bold" fill="#065f46">SÍ</text>
        <rect x="495" y="130" width="145" height="42" rx="6" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="567" y="155" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">Conectado ✅</text>

        <!-- Rama NO -->
        <line x1="330" y1="185" x2="330" y2="215" stroke="#2563eb" stroke-width="2.5"/>
        <text x="342" y="202" font-size="9.5" font-weight="bold" fill="#1e40af">NO</text>
        <rect x="175" y="215" width="310" height="45" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="330" y="242" font-size="10.5" font-weight="bold" fill="#1e40af" text-anchor="middle">2. Renderizar QR y Vincular con WhatsApp Móvil</text>
    </svg>
    <div class="diagram-caption">Figura 7.1 - Diagrama de Flujo de Actividad (BPMN) para la Conexión QR</div>
</div>

<h2>7.2 Flujograma: Agendamiento de Citas por WhatsApp Bot</h2>
<p>
1. <strong>Inicio de Interacción:</strong> Cliente envía mensaje inicial al número de Hidrosys EC.<br>
2. <strong>Despliegue del Menú:</strong> El bot envía las opciones numeradas en texto plano ('1', '2', '3').<br>
3. <strong>Selección:</strong> El cliente selecciona la opción '1' (Agendar Cita).<br>
4. <strong>Validación de Campos:</strong> El bot solicita e inspecciona Nombre, Dirección y Fecha.<br>
5. <strong>Persistencia DB:</strong> Se inserta la orden con estado <code>Pendiente</code> y se confirma al usuario.
</p>
"""

# =========================================================================
# DOCUMENTO 8: PROBLEMAS ENCONTRADOS Y SOLUCIONES DE INGENIERÍA
# =========================================================================
DOC8_CONTENT = f"""
<h1>8. CASOS DE ESTUDIO: PROBLEMAS ENCONTRADOS Y SOLUCIONES DE INGENIERÍA</h1>
<p>
Este informe documenta con rigurosidad las problemáticas técnicas enfrentadas en el desarrollo de <strong>Hidrosys EC.</strong> y las soluciones superadas en arquitectura y diseño.
</p>

<h2>8.1 Diagrama Comparativo Antes vs. Después en Hidrosys EC.</h2>
<div class="diagram-box">
    <svg width="660" height="200" viewBox="0 0 660 200">
        <!-- Izquierda: Problema -->
        <rect x="25" y="30" width="280" height="140" rx="12" fill="#fef2f2" stroke="#ef4444" stroke-width="2"/>
        <text x="165" y="62" font-size="11.5" font-weight="bold" fill="#b91c1c" text-anchor="middle">PROBLEMA EN DETECCIONES</text>
        <text x="165" y="92" font-size="9.5" fill="#991b1b" text-anchor="middle">• Botones interactivos no cargaban en celulares</text>
        <text x="165" y="115" font-size="9.5" fill="#991b1b" text-anchor="middle">• Dependencia del programador para QR</text>
        <text x="165" y="138" font-size="9.5" fill="#991b1b" text-anchor="middle">• Riesgo de endpoints desprotegidos</text>

        <!-- Flecha -->
        <line x1="315" y1="100" x2="345" y2="100" stroke="#002e6e" stroke-width="3.5" marker-end="url(#arrow)"/>

        <!-- Derecha: Solución -->
        <rect x="355" y="30" width="280" height="140" rx="12" fill="#f0fdf4" stroke="#10b981" stroke-width="2"/>
        <text x="495" y="62" font-size="11.5" font-weight="bold" fill="#166534" text-anchor="middle">SOLUCIÓN HIDROSYS EC. v3.0</text>
        <text x="495" y="92" font-size="9.5" fill="#14532d" text-anchor="middle">• Menú Numérico plano 100% confiable</text>
        <text x="495" y="115" font-size="9.5" fill="#14532d" text-anchor="middle">• Pestaña "📱 Escanear QR" autónoma</text>
        <text x="495" y="138" font-size="9.5" fill="#14532d" text-anchor="middle">• Middleware requireAuth en endpoints</text>
    </svg>
    <div class="diagram-caption">Figura 8.1 - Síntesis Comparativa de Soluciones de Ingeniería Implementadas</div>
</div>

<h2>8.2 Detalle Técnico de Mitigaciones</h2>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Problema / Reto Técnico</th>
            <th>Causa Raíz Identificada</th>
            <th>Solución Arquitectónica Aplicada</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Incompatibilidad de Botones en WhatsApp</strong></td>
            <td>Las estructuras <code>nativeFlowMessage</code> de Meta son ignoradas en versiones personalizadas o cuentas móviles sin plantillas comerciales pre-aprobadas.</td>
            <td><strong>Migración a Menú Numérico Plano:</strong> Se refactorizó la función <code>menuPrincipal()</code> para retornar opciones claras numeradas (1, 2, 3), logrando 100% de éxito en entrega y legibilidad.</td>
        </tr>
        <tr>
            <td><strong>Autonomía en la Sincronización QR</strong></td>
            <td>Los operadores de oficina no podían acceder al servidor o consola de Node.js para recuperar el QR cuando el móvil perdía la sesión.</td>
            <td><strong>Pestaña Web "Escanear QR / WhatsApp":</strong> Se integró en el panel un visor en tiempo real conectado a <code>/api/wa/status</code> con botón de reinicio protegido.</td>
        </tr>
    </tbody>
</table>
"""

# =========================================================================
# DOCUMENTO 9: MOCKUPS Y PROTOTIPO ALTA FIDELIDAD DEL SISTEMA
# =========================================================================
DOC9_CONTENT = f"""
<h1>9. MOCKUPS Y PROTOTIPOS ALTA FIDELIDAD DE INTERFACES</h1>
<p>
Este informe exhibe las maquetas estructurales y prototipos visuales de alta fidelidad que conforman el diseño premium de <strong>Hidrosys EC.</strong>.
</p>

<h2>9.1 Mockup UI: Pestaña "📱 Escanear QR / WhatsApp" en Panel Web</h2>
<div class="diagram-box">
    <svg width="660" height="250" viewBox="0 0 660 250">
        <!-- Ventana Navegador -->
        <rect x="30" y="15" width="600" height="220" rx="8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
        <rect x="30" y="15" width="600" height="28" rx="8" fill="#002e6e"/>
        <text x="50" y="33" font-size="10" font-weight="bold" fill="white">HIDROSYS EC. • Panel de Control Administrador (localhost:3000)</text>

        <!-- Menú Lateral -->
        <rect x="30" y="43" width="160" height="192" fill="#1e293b"/>
        <text x="45" y="75" font-size="9.5" fill="#cbd5e1">📊 Dashboard General</text>
        <text x="45" y="105" font-size="9.5" fill="#cbd5e1">📅 Gestión de Citas</text>
        <rect x="36" y="125" width="148" height="28" rx="4" fill="#2563eb"/>
        <text x="48" y="143" font-size="9.5" font-weight="bold" fill="white">📱 Escanear QR</text>

        <!-- Área Central -->
        <rect x="205" y="60" width="405" height="160" rx="8" fill="white" stroke="#cbd5e1" stroke-width="1.5"/>
        <text x="230" y="90" font-size="12" font-weight="bold" fill="#002e6e">Conexión en Vivo con WhatsApp Bot</text>
        <rect x="230" y="108" width="200" height="38" rx="6" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="330" y="131" font-size="10.5" font-weight="bold" fill="#065f46" text-anchor="middle">¡Dispositivo Conectado! ✅</text>
        <rect x="230" y="160" width="260" height="34" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="360" y="182" font-size="9.5" font-weight="bold" fill="#1e40af" text-anchor="middle">🔄 Reiniciar Conexión / Generar QR</text>
    </svg>
    <div class="diagram-caption">Figura 9.1 - Wireframe / Mockup Esquemático de la Pestaña de Reconexión QR</div>
</div>

<h2>9.2 Prototipo Interactivo: Simulación en Chat de WhatsApp</h2>
<div class="card" style="background:#f0fdf4; border-color:#86efac;">
    <div class="card-title" style="color:#166534;">Simulación Real de Interacción en Chat de WhatsApp (+593 968245633)</div>
    <p style="font-family:monospace; font-size:9.5pt; color:#14532d;">
    <strong>Cliente:</strong> Hola, buenas tardes.<br><br>
    <strong>HIDROSYS EC. – Asistente Virtual:</strong><br>
    💧 <em>HIDROSYS EC. – Asistente Virtual</em><br>
    Atención al Cliente • Sistemas de Agua y Gas<br><br>
    ¿En qué podemos ayudarte hoy? Escribe el <strong>número</strong> de tu opción:<br><br>
    1️⃣ <strong>Agendar Cita / Inspección Técnica</strong><br>
    2️⃣ <strong>Consultar Zonas de Cobertura y Horarios</strong><br>
    3️⃣ <strong>Soporte Directo con Asesor (+593 968245633)</strong><br><br>
    <strong>Cliente:</strong> 1<br>
    <strong>HIDROSYS EC.:</strong> Excelente. Por favor indícame tu Nombre Completo para iniciar el agendamiento.
    </p>
</div>
"""

DOCS = [
    ("01_Necesidades_del_Usuario_HIDROSYS", "1. ANÁLISIS DE NECESIDADES DEL USUARIO", "Diagnóstico integral del sector, perfiles operativos y matriz MoSCoW", DOC1_CONTENT),
    ("02_Historias_de_Usuario_HIDROSYS", "2. HISTORIAS DE USUARIO Y SCRUM", "Fichas exhaustivas INVEST, ciclo ágil y criterios de aceptación", DOC2_CONTENT),
    ("03_Casos_de_Uso_Cero_y_Detallados_HIDROSYS", "3. CASOS DE USO CERO Y DETALLADOS", "Modelado canónico con actores UML y fichas operativas por rol", DOC3_CONTENT),
    ("04_Casos_de_Uso_de_Contexto_HIDROSYS", "4. CASOS DE USO DE CONTEXTO", "Delimitación de fronteras, interfaces externas y protocolos de red", DOC4_CONTENT),
    ("05_Casos_de_Uso_de_Escenario_HIDROSYS", "5. CASOS DE USO DE ESCENARIO", "Diagramas de secuencia y flujos paso a paso en situaciones reales", DOC5_CONTENT),
    ("06_Requisitos_Funcionales_y_No_Funcionales_HIDROSYS", "6. REQUISITOS FUNCIONALES Y NO FUNCIONALES", "Catálogo técnico completo de ingeniería RF y RNF verificados", DOC6_CONTENT),
    ("07_Diagramas_de_Actividades_y_Flujos_HIDROSYS", "7. DIAGRAMAS DE ACTIVIDADES Y FLUJOS", "Flujogramas BPMN de sincronización QR y agendamiento de citas", DOC7_CONTENT),
    ("08_Problemas_Encontrados_y_Soluciones_HIDROSYS", "8. PROBLEMAS ENCONTRADOS Y SOLUCIONES", "Análisis comparativo Antes/Después y mitigación arquitectónica", DOC8_CONTENT),
    ("09_Mockups_y_Prototipos_del_Sistema_HIDROSYS", "9. MOCKUPS Y PROTOTIPOS DEL SISTEMA", "Maquetas UI del Dashboard web y simulación en WhatsApp móvil", DOC9_CONTENT),
]

def generate_all():
    print(f"Iniciando generación exhaustiva de los {len(DOCS)} informes oficiales PACTE...")
    for doc_code, doc_title, doc_summary, content in DOCS:
        html_path = os.path.join(OUTPUT_DIR, f"{doc_code}.html")
        pdf_path = os.path.join(OUTPUT_DIR, f"{doc_code}.pdf")
        
        html_str = wrap_html(doc_code, doc_title, doc_summary, content)
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_str)
        
        print(f"Generado HTML: {doc_code}.html -> Convirtiendo a PDF con Edge...")
        cmd = [
            EDGE_PATH,
            "--headless",
            f"--print-to-pdf={pdf_path}",
            html_path
        ]
        subprocess.run(cmd, capture_output=True, text=True)
        if os.path.exists(pdf_path):
            size = os.path.getsize(pdf_path)
            print(f"  [OK] PDF generado: {doc_code}.pdf ({size} bytes)")
        else:
            print(f"  [ERROR] No se pudo generar PDF para {doc_code}")

if __name__ == "__main__":
    generate_all()
