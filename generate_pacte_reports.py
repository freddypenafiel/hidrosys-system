# -*- coding: utf-8 -*-
import os
import subprocess

OUTPUT_DIR = r"C:\Users\fredd\.gemini\antigravity\scratch\hidrosys-system\INFORMES_PACTE_SEPARADOS"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# Helper SVG para dibujar Muñeco de Caso de Uso UML (Actor Stick Figure)
def svg_uml_actor(x, y, name, color="#002e6e"):
    return f"""
    <g transform="translate({x}, {y})">
        <!-- Cabeza -->
        <circle cx="0" cy="-32" r="12" fill="{color}" stroke="#1e40af" stroke-width="2"/>
        <!-- Cuerpo -->
        <line x1="0" y1="-20" x2="0" y2="14" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
        <!-- Brazos -->
        <line x1="-18" y1="-8" x2="18" y2="-8" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
        <!-- Piernas -->
        <line x1="0" y1="14" x2="-15" y2="38" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
        <line x1="0" y1="14" x2="15" y2="38" stroke="{color}" stroke-width="3" stroke-linecap="round"/>
        <!-- Nombre Actor -->
        <text x="0" y="56" font-family="'Outfit', sans-serif" font-size="11.5" font-weight="700" fill="#0f172a" text-anchor="middle">{name}</text>
    </g>
    """

COVER_TEMPLATE = """
    <!-- ==================== PORTADA OFICIAL ==================== -->
    <div class="cover-page">
        <div class="cover-header">
            <div class="cover-logo-area">
                <svg width="60" height="60" viewBox="0 0 100 100" style="margin-right:15px;">
                    <path d="M10,20 Q10,10 50,10 Q90,10 90,20 L90,60 Q90,90 50,95 Q10,90 10,60 Z" fill="#002e6e" stroke="#ffffff" stroke-width="2"/>
                    <path d="M20,40 Q35,35 50,40 Q65,45 80,40" fill="none" stroke="#2563eb" stroke-width="4"/>
                    <path d="M20,55 Q35,50 50,55 Q65,60 80,55" fill="none" stroke="#60a5fa" stroke-width="4"/>
                    <polygon points="30,35 50,15 70,35" fill="#f59e0b"/>
                </svg>
                <div>
                    <div class="cover-title-univ">INSTITUTO SUPERIOR TECNOLÓGICO DEL AUSTRO</div>
                    <div class="cover-subtitle-univ">EXCELENCIA ACADÉMICA Y TECNOLÓGICA</div>
                </div>
            </div>
            
            <div class="cover-meta-grid">
                <div class="meta-box">
                    <span class="meta-label">CARRERA</span>
                    <span class="meta-value">TECNOLOGÍA SUPERIOR EN DESARROLLO DE SOFTWARE</span>
                </div>
                <div class="meta-box">
                    <span class="meta-label">PROYECTO PACTE</span>
                    <span class="meta-value">ANÁLISIS, DISEÑO E IMPLEMENTACIÓN DE SISTEMAS</span>
                </div>
            </div>
        </div>

        <div class="cover-center">
            <div class="doc-badge">{doc_code} • DOCUMENTO OFICIAL PACTE</div>
            <h1 class="cover-project-title">SISTEMA INTEGRAL DE GESTIÓN DE CITAS, ATENCIÓN AUTOMATIZADA Y AGENDAMIENTO VÍA WHATSAPP BOT (HIDROSYS EC.)</h1>
            <h2 class="cover-doc-title">{doc_title}</h2>
            <p class="cover-doc-summary">{doc_summary}</p>
        </div>

        <div class="cover-footer">
            <div class="authors-grid">
                <div class="author-card">
                    <span class="author-role">ESTUDIANTE / AUTOR DEL PROYECTO</span>
                    <span class="author-name">Freddy Peñafiel</span>
                    <span class="author-desc">Desarrollador Principal • Proyecto Hidrosys EC.</span>
                </div>
                <div class="author-card">
                    <span class="author-role">DOCENTE / TUTOR ACADÉMICO</span>
                    <span class="author-name">Ing. Fabricio Lucero</span>
                    <span class="author-desc">Tutor de Proyecto PACTE • IST del Austro</span>
                </div>
            </div>
            <div class="cover-date">Cuenca, Ecuador • Periodo Académico 2026</div>
        </div>
    </div>
"""

CSS_STYLES = """
    @page {
        size: A4;
        margin: 18mm 15mm 18mm 15mm;
        @bottom-right {
            content: "Página " counter(page);
            font-family: 'Inter', sans-serif;
            font-size: 8pt;
            color: #64748b;
        }
        @bottom-left {
            content: "HIDROSYS EC. • Proyecto PACTE • Freddy Peñafiel | Tutor: Ing. Fabricio Lucero";
            font-family: 'Inter', sans-serif;
            font-size: 8pt;
            color: #64748b;
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
        line-height: 1.5;
        background: white;
        font-size: 9.5pt;
    }

    .container { max-width: 100%; margin: 0 auto; }

    /* Portada Estilo Universitario */
    .cover-page {
        height: 90vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 10px 10px;
        page-break-after: always;
    }
    .cover-header { border-bottom: 3px solid var(--ista-blue); padding-bottom: 18px; }
    .cover-logo-area { display: flex; align-items: center; justify-content: center; margin-bottom: 15px; }
    .cover-title-univ {
        font-family: 'Outfit', sans-serif;
        font-size: 1.45rem;
        font-weight: 800;
        color: var(--ista-blue);
        letter-spacing: 0.5px;
    }
    .cover-subtitle-univ { font-size: 0.85rem; font-weight: 600; color: #475569; letter-spacing: 2px; }
    .cover-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
    .meta-box { background: var(--gray-100); padding: 8px 12px; border-left: 4px solid var(--accent); border-radius: 4px; }
    .meta-label { display: block; font-size: 0.7rem; font-weight: 700; color: #64748b; letter-spacing: 1px; }
    .meta-value { font-size: 0.85rem; font-weight: 700; color: var(--primary); }

    .cover-center { text-align: center; padding: 25px 15px; }
    .doc-badge {
        display: inline-block;
        background: #eff6ff;
        color: var(--accent);
        font-weight: 700;
        font-size: 0.8rem;
        padding: 5px 14px;
        border-radius: 20px;
        letter-spacing: 1.5px;
        margin-bottom: 15px;
        border: 1px solid #bfdbfe;
    }
    .cover-project-title {
        font-family: 'Outfit', sans-serif;
        font-size: 1.3rem;
        font-weight: 800;
        color: var(--primary);
        line-height: 1.35;
        margin-bottom: 15px;
    }
    .cover-doc-title {
        font-family: 'Outfit', sans-serif;
        font-size: 1.6rem;
        font-weight: 800;
        color: var(--ista-blue);
        margin-bottom: 12px;
        padding: 10px 0;
        border-top: 1px solid var(--gray-200);
        border-bottom: 1px solid var(--gray-200);
    }
    .cover-doc-summary {
        font-size: 0.95rem;
        color: #475569;
        max-width: 85%;
        margin: 0 auto;
    }

    .cover-footer { border-top: 2px solid var(--gray-200); padding-top: 18px; }
    .authors-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 12px; }
    .author-card { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid var(--gray-200); }
    .author-role { display: block; font-size: 0.7rem; font-weight: 700; color: var(--accent); letter-spacing: 1px; }
    .author-name { display: block; font-size: 1.1rem; font-weight: 800; color: var(--primary); margin: 3px 0; }
    .author-desc { font-size: 0.8rem; color: #64748b; }
    .cover-date { text-align: center; font-size: 0.85rem; font-weight: 600; color: #64748b; }

    /* Estilos del Contenido */
    .page-break { page-break-after: always; }
    h1, h2, h3, h4 { font-family: 'Outfit', sans-serif; color: var(--primary); margin-top: 18px; margin-bottom: 8px; }
    h1 { font-size: 1.45rem; border-bottom: 2px solid var(--ista-blue); padding-bottom: 6px; }
    h2 { font-size: 1.2rem; color: var(--ista-blue); }
    h3 { font-size: 1.05rem; }
    p { margin-bottom: 10px; text-align: justify; }

    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 8.8pt; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: var(--ista-blue); color: white; padding: 9px 8px; text-align: left; font-weight: 600; }
    td { padding: 8px 8px; border-bottom: 1px solid var(--gray-200); vertical-align: top; }
    tr:nth-child(even) { background: #f8fafc; }

    .card { background: #f8fafc; border: 1px solid var(--gray-200); border-radius: 6px; padding: 14px; margin: 14px 0; page-break-inside: avoid; }
    .card-title { font-weight: 700; color: var(--ista-blue); margin-bottom: 6px; font-size: 10.5pt; }

    .badge-req { display: inline-block; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 7.8pt; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }

    ul, ol { margin-left: 20px; margin-bottom: 12px; }
    li { margin-bottom: 5px; }

    .diagram-box {
        background: #ffffff;
        border: 2px solid var(--gray-200);
        border-radius: 8px;
        padding: 16px 10px;
        margin: 16px 0;
        text-align: center;
        page-break-inside: avoid;
    }
    .diagram-caption {
        font-weight: 700;
        font-size: 9pt;
        color: var(--ista-blue);
        margin-top: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
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

# -------------------------------------------------------------------------
# DOCUMENTO 1: NECESIDADES DEL USUARIO (CON DIAGRAMA DE ACTORES UML)
# -------------------------------------------------------------------------
DOC1_CONTENT = f"""
<h1>1. ANÁLISIS DE NECESIDADES DEL USUARIO Y STAKEHOLDERS</h1>
<p>
El presente informe documenta el estudio de requerimientos y necesidades operativas para <strong>Hidrosys EC.</strong>, plataforma integral de gestión de citas, asistencia virtual por WhatsApp y control de cuadrillas para servicios de agua y gas.
</p>

<h2>1.1 Diagrama Estructural de Actores e Interesados (UML Stakeholders)</h2>
<p>
El siguiente diagrama ilustra la interacción visual entre los actores humanos (muñecos UML) y la arquitectura central del sistema Hidrosys EC.:
</p>

<div class="diagram-box">
    <svg width="680" height="260" viewBox="0 0 680 260">
        <!-- Actor 1: Cliente -->
        {svg_uml_actor(70, 75, "Cliente / Usuario")}
        
        <!-- Actor 2: Administrador Principal -->
        {svg_uml_actor(70, 195, "Super Administrador")}

        <!-- Actor 3: Administrador Secundario -->
        {svg_uml_actor(610, 75, "Operador Oficina")}

        <!-- Actor 4: Trabajador Técnico -->
        {svg_uml_actor(610, 195, "Trabajador Técnico")}

        <!-- Sistema Central -->
        <rect x="180" y="30" width="320" height="195" rx="14" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="340" y="60" font-family="'Outfit', sans-serif" font-size="13" font-weight="800" fill="#002e6e" text-anchor="middle">ECOSISTEMA HIDROSYS EC.</text>

        <rect x="205" y="80" width="270" height="40" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="340" y="105" font-size="11" font-weight="700" fill="#1e40af" text-anchor="middle">Asistente Virtual WhatsApp Bot</text>

        <rect x="205" y="135" width="270" height="40" rx="8" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="340" y="160" font-size="11" font-weight="700" fill="#065f46" text-anchor="middle">Panel Web & Reconexión QR Vivo</text>

        <!-- Líneas de Interacción -->
        <line x1="110" y1="75" x2="205" y2="95" stroke="#334155" stroke-width="2" marker-end="url(#arrow)"/>
        <line x1="110" y1="195" x2="205" y2="155" stroke="#334155" stroke-width="2"/>
        <line x1="570" y1="75" x2="475" y2="100" stroke="#334155" stroke-width="2"/>
        <line x1="570" y1="195" x2="475" y2="155" stroke="#334155" stroke-width="2"/>
    </svg>
    <div class="diagram-caption">Fig 1.1 - Mapa Relacional de Actores e Interacción con Hidrosys EC.</div>
</div>

<h2>1.2 Matriz Detallada de Necesidades por Actor</h2>
<table>
    <thead>
        <tr>
            <th style="width:18%;">Actor / Rol</th>
            <th style="width:25%;">Canal Principal</th>
            <th>Necesidad Identificada y Solución Tecnológica</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Cliente / Usuario Final</strong></td>
            <td>WhatsApp Messenger</td>
            <td>Requiere agendar citas técnicas sin esperas telefónicas. Solución: Bot conversacional con menú numérico (1, 2, 3) compatible 100% con todos los móviles.</td>
        </tr>
        <tr>
            <td><strong>Administrador Principal</strong></td>
            <td>Dashboard Web (Super Admin)</td>
            <td>Requiere autogestionar la reconexión de WhatsApp sin depender de programadores. Solución: Pestaña <code>📱 Escanear QR / WhatsApp</code> en tiempo real.</td>
        </tr>
        <tr>
            <td><strong>Administrador Secundario</strong></td>
            <td>Dashboard Web (Operador)</td>
            <td>Requiere revisar citas pendientes y asignar órdenes de trabajo a cuadrillas técnicas.</td>
        </tr>
        <tr>
            <td><strong>Trabajador Técnico</strong></td>
            <td>WhatsApp / Móvil</td>
            <td>Requiere visualizar la dirección del cliente y registrar el cierre del trabajo en campo.</td>
        </tr>
    </tbody>
</table>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 2: HISTORIAS DE USUARIO (CON DIAGRAMA AGILE SCRUM)
# -------------------------------------------------------------------------
DOC2_CONTENT = f"""
<h1>2. HISTORIAS DE USUARIO Y FLUJO DE VALOR ÁGIL</h1>
<p>
Las Historias de Usuario de <strong>Hidrosys EC.</strong> articulan las funcionalidades bajo el estándar INVEST del marco Scrum, garantizando una trazabilidad completa desde la necesidad del usuario hasta la entrega verificada.
</p>

<h2>2.1 Diagrama de Flujo de Valor y Sprints (Agile Scrum)</h2>
<div class="diagram-box">
    <svg width="680" height="210" viewBox="0 0 680 210">
        <!-- Muñeco Cliente -->
        {svg_uml_actor(60, 85, "Actor Usuario")}
        <line x1="95" y1="85" x2="160" y2="85" stroke="#2563eb" stroke-width="2.5"/>

        <!-- Backlog -->
        <rect x="160" y="45" width="130" height="80" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
        <text x="225" y="75" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">Product Backlog</text>
        <text x="225" y="95" font-size="9.5" fill="#1e40af" text-anchor="middle">HU-01 a HU-06</text>

        <line x1="290" y1="85" x2="350" y2="85" stroke="#2563eb" stroke-width="2.5"/>

        <!-- Sprint Execution -->
        <rect x="350" y="45" width="140" height="80" rx="40" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
        <text x="420" y="75" font-size="11" font-weight="bold" fill="#92400e" text-anchor="middle">Sprint Iterativo</text>
        <text x="420" y="95" font-size="9.5" fill="#92400e" text-anchor="middle">Desarrollo & Pruebas</text>

        <line x1="490" y1="85" x2="550" y2="85" stroke="#10b981" stroke-width="2.5"/>

        <!-- Incremento -->
        <rect x="550" y="45" width="110" height="80" rx="8" fill="#d1fae5" stroke="#065f46" stroke-width="2"/>
        <text x="605" y="75" font-size="11" font-weight="bold" fill="#065f46" text-anchor="middle">Entrega Final</text>
        <text x="605" y="95" font-size="9.5" fill="#065f46" text-anchor="middle">Sistema Funcional</text>
    </svg>
    <div class="diagram-caption">Fig 2.1 - Flujo Ágil de Implementación de Historias de Usuario</div>
</div>

<h2>2.2 Fichas Técnicas de Historias de Usuario</h2>

<div class="card">
    <div class="card-title">HU-01: Menú Numérico Confiable en WhatsApp</div>
    <p><strong>Como</strong> cliente de Hidrosys EC.,<br>
    <strong>Quiero</strong> recibir opciones numeradas claras en texto simple al escribir al bot,<br>
    <strong>Para</strong> poder seleccionar con un número (1, 2, 3) sin bloqueos por incompatibilidad de botones en mi celular.</p>
    <p><strong>Criterios de Aceptación:</strong> Envío en &lt; 1.5s, respuesta correcta a opciones numéricas, tolerancia a errores.</p>
</div>

<div class="card">
    <div class="card-title">HU-02: Agendamiento Paso a Paso vía WhatsApp</div>
    <p><strong>Como</strong> cliente o empresa solicitante,<br>
    <strong>Quiero</strong> registrar mi Nombre, Dirección, Servicio y Fecha/Hora conversando con el bot,<br>
    <strong>Para</strong> coordinar mi visita técnica sin esperas telefónicas.</p>
</div>

<div class="card">
    <div class="card-title">HU-03: Reconexión QR en Tiempo Real desde Panel Web</div>
    <p><strong>Como</strong> Administrador / Dueño de Hidrosys EC.,<br>
    <strong>Quiero</strong> disponer de la pestaña <code>📱 Escanear QR / WhatsApp</code> en el panel web con el QR en vivo,<br>
    <strong>Para</strong> vincular el celular corporativo al instante ante cualquier desconexión sin asistencia de programadores.</p>
</div>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 3: CASOS DE USO CERO Y DETALLADOS (CON MUÑECOS UML OFICIALES)
# -------------------------------------------------------------------------
DOC3_CONTENT = f"""
<h1>3. CASOS DE USO CERO Y DETALLADOS POR ROL (UML COMPLETO)</h1>
<p>
Este informe documenta formalmente la estructura conductual del sistema <strong>Hidrosys EC.</strong> a través del <strong>Diagrama de Casos de Uso Cero (Vista Global de Frontera)</strong> y los diagramas específicos por cada rol institucional.
</p>

<h2>3.1 Diagrama de Casos de Uso Cero (Vista General del Sistema con Muñecos UML)</h2>
<p>
El siguiente diagrama UML ilustra a los cuatro actores principales (muñecos) interactuando con las elipses de frontera dentro del límite del sistema Hidrosys EC.:
</p>

<div class="diagram-box">
    <svg width="680" height="340" viewBox="0 0 680 340">
        <!-- Muñeco 1: Cliente WhatsApp -->
        {svg_uml_actor(65, 80, "Cliente WhatsApp")}

        <!-- Muñeco 2: Administrador Principal -->
        {svg_uml_actor(65, 235, "Super Administrador")}

        <!-- Muñeco 3: Administrador Secundario -->
        {svg_uml_actor(615, 80, "Operador Oficina")}

        <!-- Muñeco 4: Trabajador Técnico -->
        {svg_uml_actor(615, 235, "Trabajador Técnico")}

        <!-- Caja Frontera del Sistema -->
        <rect x="155" y="15" width="370" height="310" rx="14" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="340" y="42" font-family="'Outfit', sans-serif" font-size="12.5" font-weight="800" fill="#002e6e" text-anchor="middle">SISTEMA INTEGRAL HIDROSYS EC.</text>

        <!-- Elipse 1: Agendar Cita y Consultar -->
        <ellipse cx="340" cy="85" rx="135" ry="24" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="340" y="89" font-size="10.5" font-weight="700" fill="#1e40af" text-anchor="middle">UC-01: Interactuar Bot & Agendar Cita</text>

        <!-- Elipse 2: Escanear QR WhatsApp -->
        <ellipse cx="340" cy="148" rx="135" ry="24" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="340" y="152" font-size="10.5" font-weight="700" fill="#065f46" text-anchor="middle">UC-02: Escanear QR y Reconectar Bot</text>

        <!-- Elipse 3: Gestión de Citas y Órdenes -->
        <ellipse cx="340" cy="211" rx="135" ry="24" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="340" y="215" font-size="10.5" font-weight="700" fill="#92400e" text-anchor="middle">UC-03: Gestionar Órdenes y Cuadrillas</text>

        <!-- Elipse 4: Registrar Avance en Campo -->
        <ellipse cx="340" cy="274" rx="135" ry="24" fill="#f3e8ff" stroke="#7e22ce" stroke-width="1.5"/>
        <text x="340" y="278" font-size="10.5" font-weight="700" fill="#6b21a8" text-anchor="middle">UC-04: Ejecución y Reporte en Campo</text>

        <!-- Líneas Actor - Elipses -->
        <line x1="95" y1="80" x2="205" y2="85" stroke="#334155" stroke-width="2"/>
        <line x1="95" y1="235" x2="205" y2="148" stroke="#334155" stroke-width="2"/>
        <line x1="95" y1="235" x2="205" y2="211" stroke="#334155" stroke-width="2"/>
        <line x1="585" y1="80" x2="475" y2="211" stroke="#334155" stroke-width="2"/>
        <line x1="585" y1="235" x2="475" y2="274" stroke="#334155" stroke-width="2"/>
    </svg>
    <div class="diagram-caption">Fig 3.1 - Diagrama UML de Casos de Uso Cero (Vista de Frontera Global)</div>
</div>

<h2>3.2 Casos de Uso Detallados por Rol</h2>

<h3>3.2.1 Rol: Administrador Principal (Diagrama y Detalle CUD-01)</h3>
<div class="diagram-box">
    <svg width="600" height="150" viewBox="0 0 600 150">
        {svg_uml_actor(70, 70, "Admin Principal")}
        <rect x="180" y="20" width="380" height="110" rx="10" fill="#f8fafc" stroke="#002e6e" stroke-width="2"/>
        <ellipse cx="370" cy="55" rx="140" ry="20" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="370" y="59" font-size="10.5" font-weight="bold" fill="#065f46" text-anchor="middle">CUD-01: Escanear QR en Pestaña Admin</text>
        <ellipse cx="370" cy="100" rx="140" ry="20" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="370" y="104" font-size="10.5" font-weight="bold" fill="#1e40af" text-anchor="middle">CUD-02: Control Middleware requireAuth</text>
        <line x1="100" y1="70" x2="230" y2="55" stroke="#334155" stroke-width="2"/>
        <line x1="100" y1="70" x2="230" y2="100" stroke="#334155" stroke-width="2"/>
    </svg>
    <div class="diagram-caption">Fig 3.2 - Casos de Uso Específicos del Administrador Principal</div>
</div>

<table>
    <thead>
        <tr>
            <th style="width:25%;">Atributo</th>
            <th>Especificación Operativa</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Identificador</strong></td>
            <td><strong>CUD-01: Sincronización QR de WhatsApp desde el Panel Web</strong></td>
        </tr>
        <tr>
            <td><strong>Actor Principal</strong></td>
            <td>Administrador Principal / Dueño de Empresa</td>
        </tr>
        <tr>
            <td><strong>Flujo Normal</strong></td>
            <td>
                1. El administrador ingresa a su sesión web y hace clic en <strong>📱 Escanear QR / WhatsApp</strong>.<br>
                2. El servidor consulta en vivo el socket de Baileys.<br>
                3. Si el bot está desconectado, se renderiza el QR en pantalla.<br>
                4. El administrador escanea con su celular corporativo y el sistema actualiza automáticamente a <strong>¡Dispositivo Conectado! ✅</strong>.
            </td>
        </tr>
    </tbody>
</table>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 4: CASOS DE USO DE CONTEXTO (CON DIAGRAMA DE ARQUITECTURA)
# -------------------------------------------------------------------------
DOC4_CONTENT = f"""
<h1>4. CASOS DE USO DE CONTEXTO Y ARQUITECTURA DE FRONTERA</h1>
<p>
El análisis de contexto especifica las fronteras tecnológicas e interconexiones entre los clientes móviles, el motor conversacional y la persistencia institucional.
</p>

<h2>4.1 Diagrama Arquitectónico de Contexto y Fronteras</h2>
<div class="diagram-box">
    <svg width="680" height="220" viewBox="0 0 680 220">
        <!-- Bloque 1: Cliente WhatsApp -->
        <rect x="25" y="70" width="130" height="80" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
        <text x="90" y="105" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">WhatsApp App</text>
        <text x="90" y="125" font-size="9" fill="#1e40af" text-anchor="middle">(Cliente Android/iOS)</text>

        <!-- Flecha 1 -->
        <line x1="155" y1="110" x2="225" y2="110" stroke="#334155" stroke-width="2"/>
        <text x="190" y="100" font-size="8.5" fill="#64748b" text-anchor="middle">WebSocket</text>

        <!-- Bloque 2: Servidor Node.js -->
        <rect x="225" y="40" width="220" height="140" rx="12" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="335" y="70" font-size="12" font-weight="800" fill="#002e6e" text-anchor="middle">BACKEND HIDROSYS EC.</text>
        <rect x="245" y="85" width="180" height="32" rx="6" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="335" y="105" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">Motor Baileys / QR Stream</text>
        <rect x="245" y="128" width="180" height="32" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="335" y="148" font-size="10" font-weight="bold" fill="#92400e" text-anchor="middle">API REST & requireAuth</text>

        <!-- Flecha 2 -->
        <line x1="445" y1="110" x2="515" y2="110" stroke="#334155" stroke-width="2"/>

        <!-- Bloque 3: Base de Datos & Web -->
        <rect x="515" y="70" width="140" height="80" rx="8" fill="#f3e8ff" stroke="#7e22ce" stroke-width="2"/>
        <text x="585" y="105" font-size="11" font-weight="bold" fill="#6b21a8" text-anchor="middle">Base de Datos</text>
        <text x="585" y="125" font-size="9" fill="#6b21a8" text-anchor="middle">& Panel Admin Web</text>
    </svg>
    <div class="diagram-caption">Fig 4.1 - Fronteras de Interconexión Contextual del Sistema</div>
</div>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 5: CASOS DE USO DE ESCENARIO (CON DIAGRAMAS DE SECUENCIA)
# -------------------------------------------------------------------------
DOC5_CONTENT = f"""
<h1>5. CASOS DE USO DE ESCENARIO (DIAGRAMAS DE SECUENCIA)</h1>
<p>
Los escenarios operativos describen cronológicamente la colaboración entre componentes en flujos normales y de excepción.
</p>

<h2>5.1 Diagrama de Secuencia: Escenario de Agendamiento por WhatsApp</h2>
<div class="diagram-box">
    <svg width="660" height="230" viewBox="0 0 660 230">
        <!-- Nodos superiores -->
        <rect x="30" y="20" width="110" height="35" rx="6" fill="#002e6e"/>
        <text x="85" y="42" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Cliente</text>
        <line x1="85" y1="55" x2="85" y2="210" stroke="#64748b" stroke-dasharray="4"/>

        <rect x="200" y="20" width="120" height="35" rx="6" fill="#2563eb"/>
        <text x="260" y="42" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Bot WhatsApp</text>
        <line x1="260" y1="55" x2="260" y2="210" stroke="#64748b" stroke-dasharray="4"/>

        <rect x="380" y="20" width="120" height="35" rx="6" fill="#10b981"/>
        <text x="440" y="42" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Servidor API</text>
        <line x1="440" y1="55" x2="440" y2="210" stroke="#64748b" stroke-dasharray="4"/>

        <!-- Mensajes -->
        <line x1="85" y1="85" x2="260" y2="85" stroke="#002e6e" stroke-width="2"/>
        <text x="172" y="78" font-size="9" fill="#002e6e" text-anchor="middle">1. Escribe "Hola" / Opción '1'</text>

        <line x1="260" y1="130" x2="440" y2="130" stroke="#2563eb" stroke-width="2"/>
        <text x="350" y="123" font-size="9" fill="#2563eb" text-anchor="middle">2. Envía Parámetros de Cita</text>

        <line x1="440" y1="175" x2="85" y2="175" stroke="#10b981" stroke-width="2"/>
        <text x="262" y="168" font-size="9" font-weight="bold" fill="#065f46" text-anchor="middle">3. Confirmación: Cita Registrada Exitosamente ✅</text>
    </svg>
    <div class="diagram-caption">Fig 5.1 - Secuencia Operativa del Agendamiento Automático</div>
</div>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 6: REQUISITOS FUNCIONALES Y NO FUNCIONALES (CON DIAGRAMA)
# -------------------------------------------------------------------------
DOC6_CONTENT = f"""
<h1>6. ESPECIFICACIÓN DE REQUISITOS FUNCIONALES Y NO FUNCIONALES</h1>
<p>
Catálogo formal de ingeniería de requerimientos de <strong>Hidrosys EC.</strong> clasificado bajo estándares de calidad y trazabilidad.
</p>

<h2>6.1 Diagrama de Arquitectura de Requisitos</h2>
<div class="diagram-box">
    <svg width="660" height="170" viewBox="0 0 660 170">
        <rect x="40" y="40" width="170" height="90" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
        <text x="125" y="75" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">Módulo WhatsApp Bot</text>
        <text x="125" y="98" font-size="9.5" fill="#1e40af" text-anchor="middle">RF-01: Menú Numérico</text>
        <text x="125" y="115" font-size="9.5" fill="#1e40af" text-anchor="middle">RF-02: Citas Paso a Paso</text>

        <rect x="245" y="40" width="170" height="90" rx="8" fill="#d1fae5" stroke="#065f46" stroke-width="2"/>
        <text x="330" y="75" font-size="11" font-weight="bold" fill="#065f46" text-anchor="middle">Panel Web Admin</text>
        <text x="330" y="98" font-size="9.5" fill="#065f46" text-anchor="middle">RF-03: Escanear QR en Vivo</text>
        <text x="330" y="115" font-size="9.5" fill="#065f46" text-anchor="middle">RF-05: Gestión de Órdenes</text>

        <rect x="450" y="40" width="170" height="90" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
        <text x="535" y="75" font-size="11" font-weight="bold" fill="#92400e" text-anchor="middle">Capa de Seguridad</text>
        <text x="535" y="98" font-size="9.5" fill="#92400e" text-anchor="middle">RF-04: requireAuth Token</text>
        <text x="535" y="115" font-size="9.5" fill="#92400e" text-anchor="middle">RNF-02: Latencia &lt; 250ms</text>
    </svg>
    <div class="diagram-caption">Fig 6.1 - Mapa de Trazabilidad por Módulos Funcionales</div>
</div>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 7: DIAGRAMAS DE ACTIVIDADES Y FLUJOS (FLUJOGRAMAS BPMN)
# -------------------------------------------------------------------------
DOC7_CONTENT = f"""
<h1>7. DIAGRAMAS DE ACTIVIDADES Y FLUJOS DE PROCESOS (BPMN)</h1>
<p>
Este informe contiene los flujogramas operativos que detallan la secuencia lógica de cada proceso principal.
</p>

<h2>7.1 Flujograma: Sincronización QR desde Panel Web (CU-04)</h2>
<div class="diagram-box">
    <svg width="660" height="260" viewBox="0 0 660 260">
        <circle cx="330" cy="25" r="11" fill="#002e6e"/>
        <line x1="330" y1="36" x2="330" y2="55" stroke="#334155" stroke-width="2"/>

        <rect x="180" y="55" width="300" height="38" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="330" y="78" font-size="10.5" font-weight="bold" fill="#1e40af" text-anchor="middle">1. Abrir Pestaña "📱 Escanear QR / WhatsApp"</text>
        <line x1="330" y1="93" x2="330" y2="115" stroke="#334155" stroke-width="2"/>

        <!-- Rombo decisión -->
        <polygon points="330,115 400,145 330,175 260,145" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="330" y="149" font-size="10" font-weight="bold" fill="#92400e" text-anchor="middle">¿Sesión Activa?</text>

        <!-- Rama SI -->
        <line x1="400" y1="145" x2="490" y2="145" stroke="#10b981" stroke-width="2"/>
        <text x="445" y="138" font-size="9.5" font-weight="bold" fill="#065f46">SÍ</text>
        <rect x="490" y="125" width="145" height="40" rx="6" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="562" y="149" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">Conectado ✅</text>

        <!-- Rama NO -->
        <line x1="330" y1="175" x2="330" y2="200" stroke="#2563eb" stroke-width="2"/>
        <text x="342" y="190" font-size="9.5" font-weight="bold" fill="#1e40af">NO</text>
        <rect x="180" y="200" width="300" height="42" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="330" y="225" font-size="10.5" font-weight="bold" fill="#1e40af" text-anchor="middle">2. Renderizar QR & Sincronizar en Vivo</text>
    </svg>
    <div class="diagram-caption">Fig 7.1 - Diagrama de Actividad BPMN de la Reconexión QR</div>
</div>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 8: PROBLEMAS ENCONTRADOS Y SOLUCIONES (DIAGRAMA COMPARATIVO)
# -------------------------------------------------------------------------
DOC8_CONTENT = f"""
<h1>8. ANÁLISIS DE PROBLEMAS ENCONTRADOS Y SOLUCIONES</h1>
<p>
Documentación del proceso de ingeniería aplicada para superar los retos de compatibilidad y control en el despliegue.
</p>

<h2>8.1 Diagrama Comparativo: Antes vs. Después en Hidrosys EC.</h2>
<div class="diagram-box">
    <svg width="660" height="190" viewBox="0 0 660 190">
        <!-- Caja Izquierda: Problema -->
        <rect x="30" y="30" width="280" height="130" rx="10" fill="#fef2f2" stroke="#ef4444" stroke-width="2"/>
        <text x="170" y="60" font-size="11.5" font-weight="bold" fill="#b91c1c" text-anchor="middle">PROBLEMA ANTERIOR</text>
        <text x="170" y="90" font-size="9.5" fill="#991b1b" text-anchor="middle">• Botones interactivos bloqueados en móviles</text>
        <text x="170" y="115" font-size="9.5" fill="#991b1b" text-anchor="middle">• Dependencia del programador para QR</text>

        <!-- Flecha central -->
        <line x1="320" y1="95" x2="350" y2="95" stroke="#002e6e" stroke-width="3"/>

        <!-- Caja Derecha: Solución Hidrosys -->
        <rect x="360" y="30" width="270" height="130" rx="10" fill="#f0fdf4" stroke="#10b981" stroke-width="2"/>
        <text x="495" y="60" font-size="11.5" font-weight="bold" fill="#166534" text-anchor="middle">SOLUCIÓN HIDROSYS EC. v3.0</text>
        <text x="495" y="90" font-size="9.5" fill="#14532d" text-anchor="middle">• Menú Numérico plano 100% confiable</text>
        <text x="495" y="115" font-size="9.5" fill="#14532d" text-anchor="middle">• Pestaña "📱 Escanear QR" autónoma</text>
    </svg>
    <div class="diagram-caption">Fig 8.1 - Soluciones de Arquitectura e Interfaz Implementadas</div>
</div>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 9: MOCKUPS Y PROTOTIPOS DEL SISTEMA (MOCKUP UI ESQUEMÁTICO)
# -------------------------------------------------------------------------
DOC9_CONTENT = f"""
<h1>9. MOCKUPS Y PROTOTIPO ALTA FIDELIDAD DEL SISTEMA</h1>
<p>
Esquema visual y maquetación de interfaces gráficas del panel administrativo y el flujo en WhatsApp.
</p>

<h2>9.1 Mockup de UI: Pestaña "📱 Escanear QR / WhatsApp" en Panel Web</h2>
<div class="diagram-box">
    <svg width="660" height="240" viewBox="0 0 660 240">
        <!-- Marco de Navegador -->
        <rect x="30" y="15" width="600" height="210" rx="8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
        <rect x="30" y="15" width="600" height="28" rx="8" fill="#002e6e"/>
        <text x="50" y="33" font-size="10" font-weight="bold" fill="white">HIDROSYS EC. • Panel de Control Administrador</text>

        <!-- Sidebar -->
        <rect x="30" y="43" width="150" height="182" fill="#1e293b"/>
        <text x="45" y="75" font-size="9.5" fill="#cbd5e1">📊 Dashboard</text>
        <text x="45" y="105" font-size="9.5" fill="#cbd5e1">📅 Citas Médicas</text>
        <rect x="35" y="125" width="140" height="26" rx="4" fill="#2563eb"/>
        <text x="45" y="142" font-size="9.5" font-weight="bold" fill="white">📱 Escanear QR</text>

        <!-- Contenido principal -->
        <rect x="200" y="60" width="410" height="150" rx="8" fill="white" stroke="#cbd5e1"/>
        <text x="220" y="88" font-size="12" font-weight="bold" fill="#002e6e">Conexión en Vivo con WhatsApp Bot</text>
        <rect x="220" y="105" width="180" height="35" rx="6" fill="#d1fae5" stroke="#065f46"/>
        <text x="310" y="127" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">¡Dispositivo Conectado! ✅</text>
        <rect x="220" y="155" width="240" height="32" rx="6" fill="#eff6ff" stroke="#2563eb"/>
        <text x="340" y="175" font-size="9.5" font-weight="bold" fill="#1e40af" text-anchor="middle">🔄 Reiniciar Conexión / Generar QR</text>
    </svg>
    <div class="diagram-caption">Fig 9.1 - Mockup Estructural de la Pestaña de Conexión QR en Panel Web</div>
</div>
"""

DOCS = [
    ("01_Necesidades_del_Usuario_HIDROSYS", "1. ANÁLISIS DE NECESIDADES DEL USUARIO", "Estudio y matriz de necesidades operativas y de los clientes", DOC1_CONTENT),
    ("02_Historias_de_Usuario_HIDROSYS", "2. HISTORIAS DE USUARIO (AGILE SCRUM)", "Fichas detalladas bajo el estándar INVEST y priorización", DOC2_CONTENT),
    ("03_Casos_de_Uso_Cero_y_Detallados_HIDROSYS", "3. CASOS DE USO CERO Y DETALLADOS", "Arquitectura comportamental y especificación por roles", DOC3_CONTENT),
    ("04_Casos_de_Uso_de_Contexto_HIDROSYS", "4. CASOS DE USO DE CONTEXTO", "Fronteras del sistema, interfaces externas y protocolos", DOC4_CONTENT),
    ("05_Casos_de_Uso_de_Escenario_HIDROSYS", "5. CASOS DE USO DE ESCENARIO", "Escenarios operativos principales, alternativos y de excepción", DOC5_CONTENT),
    ("06_Requisitos_Funcionales_y_No_Funcionales_HIDROSYS", "6. REQUISITOS FUNCIONALES Y NO FUNCIONALES", "Catálogo técnico formal de requisitos RF y RNF", DOC6_CONTENT),
    ("07_Diagramas_de_Actividades_y_Flujos_HIDROSYS", "7. DIAGRAMAS DE ACTIVIDADES Y FLUJOS", "Secuencias operativas gráficas y flujos del negocio", DOC7_CONTENT),
    ("08_Problemas_Encontrados_y_Soluciones_HIDROSYS", "8. PROBLEMAS ENCONTRADOS Y SOLUCIONES", "Matriz de ingeniería y mitigación técnica del proyecto", DOC8_CONTENT),
    ("09_Mockups_y_Prototipos_del_Sistema_HIDROSYS", "9. MOCKUPS Y PROTOTIPOS DEL SISTEMA", "Diseño UI/UX del panel administrativo y flujos de WhatsApp", DOC9_CONTENT),
]

def generate_all():
    print(f"Iniciando generación de {len(DOCS)} informes oficiales separados con diagramas UML...")
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
        res = subprocess.run(cmd, capture_output=True, text=True)
        if os.path.exists(pdf_path):
            size = os.path.getsize(pdf_path)
            print(f"  [OK] PDF generado: {doc_code}.pdf ({size} bytes)")
        else:
            print(f"  [ERROR] No se pudo generar PDF para {doc_code}")

if __name__ == "__main__":
    generate_all()
