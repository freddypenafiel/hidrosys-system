# -*- coding: utf-8 -*-
import os
import subprocess

OUTPUT_DIR = r"C:\Users\fredd\.gemini\antigravity\scratch\hidrosys-system\INFORMES_PACTE_SEPARADOS"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

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
    h1 { font-size: 1.5rem; border-bottom: 2px solid var(--ista-blue); padding-bottom: 6px; }
    h2 { font-size: 1.25rem; color: var(--ista-blue); }
    h3 { font-size: 1.05rem; }
    p { margin-bottom: 10px; text-align: justify; }

    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 8.8pt; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: var(--ista-blue); color: white; padding: 10px 8px; text-align: left; font-weight: 600; }
    td { padding: 9px 8px; border-bottom: 1px solid var(--gray-200); vertical-align: top; }
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
        padding: 15px;
        margin: 15px 0;
        text-align: center;
        page-break-inside: avoid;
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
# DOCUMENTO 1: NECESIDADES DEL USUARIO
# -------------------------------------------------------------------------
DOC1_CONTENT = """
<h1>1. ANÁLISIS DE NECESIDADES DEL USUARIO</h1>
<p>
El presente documento describe de manera sistemática y rigurosa las necesidades reales identificadas para el proyecto <strong>Hidrosys EC.</strong>, un sistema integral diseñado para solucionar la saturación en la atención al cliente, el agendamiento de citas técnicas y el monitoreo operativo en empresas proveedoras y de mantenimiento de sistemas de agua potable y gas.
</p>

<h2>1.1 Identificación de Actores e Interesados (Stakeholders)</h2>
<p>
Para una correcta delimitación funcional, se realizó una clasificación exhaustiva de los actores que interactúan directa e indirectamente con la plataforma Hidrosys EC.:
</p>
<table>
    <thead>
        <tr>
            <th style="width:18%;">Actor / Rol</th>
            <th style="width:25%;">Tipo de Interacción</th>
            <th>Descripción y Perfil Operativo</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Cliente / Usuario Final</strong></td>
            <td>WhatsApp Asistente Virtual</td>
            <td>Ciudadanos y empresas que solicitan servicios de revisión, instalación, reclamos o consulta de coberturas de agua y gas. Requieren una interfaz accesible 24/7 sin necesidad de instalar aplicaciones nuevas.</td>
        </tr>
        <tr>
            <td><strong>Administrador Principal</strong></td>
            <td>Dashboard Web (Super Admin)</td>
            <td>Responsable del control total de la plataforma, auditoría del sistema, gestión de seguridad, visualización del estado del bot de WhatsApp y vinculación mediante código QR.</td>
        </tr>
        <tr>
            <td><strong>Administrador Secundario</strong></td>
            <td>Dashboard Web (Operador)</td>
            <td>Personal de atención en oficina encargado de revisar citas agendadas, asignar órdenes de trabajo a cuadrillas técnicas y confirmar horarios.</td>
        </tr>
        <tr>
            <td><strong>Trabajador Técnico</strong></td>
            <td>WhatsApp / Panel Móvil</td>
            <td>Personal de campo encargado de visitar el domicilio o empresa del cliente, realizar el mantenimiento/inspección y registrar el avance de la orden de trabajo.</td>
        </tr>
    </tbody>
</table>

<h2>1.2 Matriz de Necesidades Específicas por Rol</h2>
<p>A continuación se detallan las problemáticas detectadas en el entorno operativo tradicional y la solución que aporta Hidrosys EC.:</p>

<div class="card">
    <div class="card-title">1. Necesidad de Agilidad en la Atención al Cliente (24/7)</div>
    <p><strong>Problema Actual:</strong> Los usuarios finales sufren largas esperas en líneas telefónicas de soporte para consultar horarios o agendar una cita técnica, generando insatisfacción.</p>
    <p><strong>Solución Hidrosys:</strong> Implementación de un Asistente Virtual automatizado en WhatsApp basado en Baileys, capaz de guiar al cliente mediante un menú numérico intuitivo y 100% compatible con todos los dispositivos.</p>
</div>

<div class="card">
    <div class="card-title">2. Necesidad de Agendamiento Sin Errores ni Conflicto de Horarios</div>
    <p><strong>Problema Actual:</strong> El registro manual en agendas físicas u hojas de cálculo ocasiona citas duplicadas en una misma franja horaria y confusión de direcciones.</p>
    <p><strong>Solución Hidrosys:</strong> Motor de citas conectado a base de datos que valida disponibilidad, registra nombre, teléfono, fecha y hora, y notifica automáticamente al Administrador.</p>
</div>

<div class="card">
    <div class="card-title">3. Necesidad de Autonomía en la Vinculación del Bot (Escanear QR)</div>
    <p><strong>Problema Actual:</strong> Cuando el dispositivo móvil de la empresa pierde conexión o reinicia WhatsApp, el personal de oficina dependía del programador para volver a enlazar el bot.</p>
    <p><strong>Solución Hidrosys:</strong> Integración de la pestaña dedicada <em>"📱 Escanear QR / WhatsApp"</em> en el Panel de Administración web, permitiendo al dueño o administrador sincronizar en tiempo real el QR con seguridad y cifrado.</p>
</div>

<h2>1.3 Priorización de Necesidades (Metodología MoSCoW)</h2>
<table>
    <thead>
        <tr>
            <th>Prioridad MoSCoW</th>
            <th>Código</th>
            <th>Necesidad / Requisito Asociado</th>
            <th>Impacto en el Sistema</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><span class="badge-req badge-success">MUST HAVE (Esencial)</span></td>
            <td>NEC-01</td>
            <td>Comunicación automatizada bidireccional por WhatsApp (Menú Numérico confiable)</td>
            <td>Alto (Núcleo del servicio de atención)</td>
        </tr>
        <tr>
            <td><span class="badge-req badge-success">MUST HAVE (Esencial)</span></td>
            <td>NEC-02</td>
            <td>Agendamiento y persistencia de citas técnicas en base de datos</td>
            <td>Alto (Operatividad del negocio)</td>
        </tr>
        <tr>
            <td><span class="badge-req badge-success">MUST HAVE (Esencial)</span></td>
            <td>NEC-03</td>
            <td>Pestaña administrativa de reconexión y escaneo QR de WhatsApp en vivo</td>
            <td>Alto (Autonomía del cliente corporativo)</td>
        </tr>
        <tr>
            <td><span class="badge-req">SHOULD HAVE (Importante)</span></td>
            <td>NEC-04</td>
            <td>Autenticación segura con JWT/Token en endpoints administrativos</td>
            <td>Alto (Integridad de datos)</td>
        </tr>
        <tr>
            <td><span class="badge-req badge-warning">COULD HAVE (Deseable)</span></td>
            <td>NEC-05</td>
            <td>Exportación de listados de citas e informes en formatos PDF y Excel</td>
            <td>Medio (Gestión gerencial)</td>
        </tr>
    </tbody>
</table>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 2: HISTORIAS DE USUARIO
# -------------------------------------------------------------------------
DOC2_CONTENT = """
<h1>2. HISTORIAS DE USUARIO (AGILE / SCRUM)</h1>
<p>
Las Historias de Usuario de <strong>Hidrosys EC.</strong> estructuran los requerimientos funcionales desde la perspectiva de valor que reciben los diferentes actores involucrados. Cada historia cumple con el estándar de calidad <strong>INVEST</strong> (Independiente, Negociable, Valiosa, Estimable, Pequeña y Comprobable).
</p>

<h2>2.1 Catálogo y Fichas de Historias de Usuario</h2>

<div class="card">
    <div class="card-title">HU-01: Navegación del Cliente por WhatsApp mediante Menú Numérico</div>
    <p><strong>Como</strong> cliente de Hidrosys EC.,<br>
    <strong>Quiero</strong> interactuar con el bot de WhatsApp enviando opciones numéricas simples (ej. 1, 2, 3),<br>
    <strong>Para</strong> obtener respuestas rápidas desde cualquier teléfono celular sin que se bloqueen los mensajes en listas o botones incompatibles.</p>
    <p><strong>Criterios de Aceptación:</strong></p>
    <ul>
        <li>El sistema debe enviar un mensaje de texto plano estructurado con opciones numeradas claras.</li>
        <li>Al recibir un número válido ('1', '2', '3'), el bot debe responder con el flujo correspondiente en menos de 1.5 segundos.</li>
        <li>Si el cliente escribe texto no numérico en el menú principal, el bot debe indicar cortésmente cómo seleccionar una opción.</li>
    </ul>
</div>

<div class="card">
    <div class="card-title">HU-02: Agendamiento Rápido de Inspecciones y Citas</div>
    <p><strong>Como</strong> usuario final,<br>
    <strong>Quiero</strong> agendar una cita técnica proporcionando mis datos básicos por el chat de WhatsApp,<br>
    <strong>Para</strong> coordinar una visita de mantenimiento de agua o gas sin tener que llamar por teléfono.</p>
    <p><strong>Criterios de Aceptación:</strong></p>
    <ul>
        <li>El bot solicita secuencialmente: Nombre, Dirección, Tipo de Servicio y Fecha/Hora preferida.</li>
        <li>Una vez confirmados los datos, el sistema almacena el registro en la base de datos con estado "Pendiente".</li>
        <li>Se envía un comprobante en texto por WhatsApp al cliente con el ID de su cita agendada.</li>
    </ul>
</div>

<div class="card">
    <div class="card-title">HU-03: Reconexión Autónoma del Bot mediante Pestaña "Escanear QR"</div>
    <p><strong>Como</strong> Administrador / Dueño de la empresa Hidrosys,<br>
    <strong>Quiero</strong> acceder a una pestaña específica en mi panel web que muestre el código QR de WhatsApp en vivo,<br>
    <p><strong>Para</strong> escanearlo desde el celular corporativo y reconectar el bot instantáneamente en caso de pérdida de sesión.</p>
    <p><strong>Criterios de Aceptación:</strong></p>
    <ul>
        <li>El panel web debe incluir en el menú lateral de Administración la pestaña <code>📱 Escanear QR / WhatsApp</code>.</li>
        <li>El sistema consulta al servidor en tiempo real el estado de conexión de Baileys.</li>
        <li>Si está desconectado, renderiza el código QR actualizado; si se conecta, muestra automáticamente "¡Dispositivo Conectado! ✅".</li>
        <li>Incluye un botón seguro "Reiniciar Conexión / Generar Nuevo QR" protegido por autenticación.</li>
    </ul>
</div>

<div class="card">
    <div class="card-title">HU-04: Autenticación y Seguridad en Endpoints Administrativos</div>
    <p><strong>Como</strong> Administrador del Sistema,<br>
    <strong>Quiero</strong> que todas las operaciones sensibles (reinicio de bot, gestión de usuarios y citas) requieran un token de sesión,<br>
    <strong>Para</strong> evitar que usuarios externos o atacantes ejecuten comandos en el servidor.</p>
    <p><strong>Criterios de Aceptación:</strong></p>
    <ul>
        <li>El middleware <code>requireAuth</code> debe verificar la cabecera <code>x-session-token</code> en cada petición POST/PUT/DELETE.</li>
        <li>Si el token no está activo en sesión, retornar un error HTTP 401 Unauthorized.</li>
    </ul>
</div>

<h2>2.2 Matriz de Resumen de Historias de Usuario</h2>
<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Nombre de la Historia</th>
            <th>Rol</th>
            <th>Puntos de Historia</th>
            <th>Estado</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>HU-01</td>
            <td>Menú Numérico de WhatsApp Confiable</td>
            <td>Cliente</td>
            <td>3 pt</td>
            <td>Completado</td>
        </tr>
        <tr>
            <td>HU-02</td>
            <td>Agendamiento Automatizado de Citas</td>
            <td>Cliente</td>
            <td>5 pt</td>
            <td>Completado</td>
        </tr>
        <tr>
            <td>HU-03</td>
            <td>Panel Web: Escanear QR y Reconectar WhatsApp</td>
            <td>Administrador</td>
            <td>8 pt</td>
            <td>Completado</td>
        </tr>
        <tr>
            <td>HU-04</td>
            <td>Seguridad Middleware requireAuth en APIs</td>
            <td>Admin / Sistema</td>
            <td>5 pt</td>
            <td>Completado</td>
        </tr>
        <tr>
            <td>HU-05</td>
            <td>Consulta de Coberturas de Agua/Gas</td>
            <td>Cliente</td>
            <td>3 pt</td>
            <td>Completado</td>
        </tr>
        <tr>
            <td>HU-06</td>
            <td>Gestión de Órdenes y Reportes PDF</td>
            <td>Administrador</td>
            <td>5 pt</td>
            <td>Completado</td>
        </tr>
    </tbody>
</table>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 3: CASOS DE USO CERO Y DETALLADOS
# -------------------------------------------------------------------------
DOC3_CONTENT = """
<h1>3. CASOS DE USO CERO Y CASOS DE USO DETALLADOS</h1>
<p>
Este documento formaliza la estructura comportamental del sistema <strong>Hidrosys EC.</strong> mediante Casos de Uso Cero (visión de frontera y contexto global) y los Casos de Uso Detallados por cada uno de los roles institucionales: <strong>Administrador Principal, Administrador Secundario y Trabajador</strong>.
</p>

<h2>3.1 Caso de Uso Cero (Diagrama Global del Sistema)</h2>
<p>
El Caso de Uso Cero representa la interacción general del ecosistema tecnológico, integrando los canales de mensajería (WhatsApp Cloud/Baileys), el backend transaccional en Node.js y las interfaces de administración web.
</p>

<div class="diagram-box">
    <h3 style="color:var(--ista-blue); margin-bottom:10px;">ARQUITECTURA FUNCIONAL DE CASOS DE USO CERO</h3>
    <svg width="600" height="240" viewBox="0 0 600 240">
        <!-- Actores -->
        <circle cx="60" cy="50" r="18" fill="#002e6e" />
        <text x="60" y="85" font-size="11" text-anchor="middle" font-weight="bold">Cliente WhatsApp</text>
        
        <circle cx="60" cy="170" r="18" fill="#2563eb" />
        <text x="60" y="205" font-size="11" text-anchor="middle" font-weight="bold">Administrador</text>

        <!-- Sistema -->
        <rect x="180" y="20" width="380" height="200" rx="12" fill="#f8fafc" stroke="#002e6e" stroke-width="2"/>
        <text x="370" y="45" font-size="13" font-weight="bold" fill="#002e6e" text-anchor="middle">SISTEMA HIDROSYS EC. (BACKEND & WEB)</text>

        <!-- Elipses UC -->
        <ellipse cx="370" cy="85" rx="140" ry="22" fill="#dbeafe" stroke="#1e40af" stroke-width="1.5"/>
        <text x="370" y="89" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">UC-01: Interactuar con Bot y Agendar Cita</text>

        <ellipse cx="370" cy="140" rx="140" ry="22" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="370" y="144" font-size="11" font-weight="bold" fill="#065f46" text-anchor="middle">UC-02: Escanear QR y Administrar Citas</text>

        <!-- Líneas -->
        <line x1="85" y1="55" x2="230" y2="80" stroke="#64748b" stroke-width="2"/>
        <line x1="85" y1="170" x2="230" y2="145" stroke="#64748b" stroke-width="2"/>
    </svg>
</div>

<h2>3.2 Detalle de Casos de Uso por Rol</h2>

<h3>3.2.1 Rol: Administrador Principal (Super Admin)</h3>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Atributo</th>
            <th>Especificación Detallada</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Código y Nombre</strong></td>
            <td><strong>CUD-01: Gestión Global y Vinculación de WhatsApp (QR)</strong></td>
        </tr>
        <tr>
            <td><strong>Actor Principal</strong></td>
            <td>Administrador Principal (Dueño / Supervisor de Sistema)</td>
        </tr>
        <tr>
            <td><strong>Precondición</strong></td>
            <td>El usuario debe haber iniciado sesión con credenciales de Administrador en <code>localhost:3000</code>.</td>
        </tr>
        <tr>
            <td><strong>Flujo Principal</strong></td>
            <td>
                1. El Administrador hace clic en la opción <strong>📱 Escanear QR / WhatsApp</strong> en el menú de Administración.<br>
                2. El sistema consulta a <code>/api/wa/status</code> la condición actual del servicio Baileys.<br>
                3. Si el bot requiere vinculación, el servidor devuelve un código QR en base64.<br>
                4. El Administrador abre WhatsApp en el celular corporativo, selecciona "Dispositivos vinculados" y escanea el QR.<br>
                5. El servidor detecta la sincronización exitosa y notifica al panel, mostrando el indicador verde <strong>¡Dispositivo Conectado! ✅</strong>.
            </td>
        </tr>
        <tr>
            <td><strong>Postcondición</strong></td>
            <td>El bot de WhatsApp queda operativo y listo para atender a clientes automáticamente.</td>
        </tr>
    </tbody>
</table>

<h3>3.2.2 Rol: Administrador Secundario (Operador de Oficina)</h3>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Atributo</th>
            <th>Especificación Detallada</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Código y Nombre</strong></td>
            <td><strong>CUD-02: Administración de Citas y Coordinación de Órdenes</strong></td>
        </tr>
        <tr>
            <td><strong>Actor Principal</strong></td>
            <td>Administrador Secundario (Personal de Atención y Logística)</td>
        </tr>
        <tr>
            <td><strong>Flujo Principal</strong></td>
            <td>
                1. El Operador ingresa a la sección <strong>📅 Gestión de Citas</strong>.<br>
                2. Visualiza la tabla filtrada por citas "Pendientes" generadas vía WhatsApp.<br>
                3. Selecciona una cita, asigna una cuadrilla técnica responsable y cambia el estado a "Confirmado".<br>
                4. El sistema envía una notificación automática en tiempo real.
            </td>
        </tr>
    </tbody>
</table>

<h3>3.2.3 Rol: Trabajador Técnico (Personal de Campo)</h3>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Atributo</th>
            <th>Especificación Detallada</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Código y Nombre</strong></td>
            <td><strong>CUD-03: Ejecución y Cierre de Orden de Trabajo en Campo</strong></td>
        </tr>
        <tr>
            <td><strong>Actor Principal</strong></td>
            <td>Trabajador Técnico de Hidrosys EC.</td>
        </tr>
        <tr>
            <td><strong>Flujo Principal</strong></td>
            <td>
                1. El técnico acude a la dirección registrada en la cita del cliente.<br>
                2. Realiza la inspección o reparación del sistema hidráulico o de gas.<br>
                3. Registra en el sistema el resultado de la visita y marca el servicio como "Completado".
            </td>
        </tr>
    </tbody>
</table>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 4: CASOS DE USO DE CONTEXTO
# -------------------------------------------------------------------------
DOC4_CONTENT = """
<h1>4. CASOS DE USO DE CONTEXTO Y ARQUITECTURA DE FRONTERA</h1>
<p>
El análisis de contexto define las fronteras físicas y lógicas entre el entorno informático de <strong>Hidrosys EC.</strong> y las entidades externas (usuarios, servidores de Meta/WhatsApp, base de datos y navegadores web).
</p>

<h2>4.1 Fronteras del Ecosistema y Componentes</h2>
<p>La plataforma se articula en cuatro capas claramente delimitadas en la arquitectura modular:</p>

<table>
    <thead>
        <tr>
            <th>Capa / Componente</th>
            <th>Tecnología</th>
            <th>Responsabilidad Contextual</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Frontera Exterior (Cliente)</strong></td>
            <td>WhatsApp Messenger / WhatsApp Business</td>
            <td>Interfaz cliente universal en teléfonos móviles Android e iOS. Transmite comandos numéricos y texto.</td>
        </tr>
        <tr>
            <td><strong>Capa de Enlace y Bot</strong></td>
            <td>Baileys WebSockets (@whiskeysockets)</td>
            <td>Motor que mantiene la sesión de WhatsApp de la empresa cifrada, emite códigos QR y procesa eventos de mensajes entrantes.</td>
        </tr>
        <tr>
            <td><strong>Servidor Central API REST</strong></td>
            <td>Node.js / Express / Middleware requireAuth</td>
            <td>Núcleo de lógica de negocio, control de rutas protegidas mediante tokens de sesión y orquestación de flujos.</td>
        </tr>
        <tr>
            <td><strong>Capa de Persistencia y Datos</strong></td>
            <td>Almacenamiento JSON / SQLite / PostgreSQL</td>
            <td>Persistencia de citas agendadas, usuarios administradores, configuraciones del sistema e historial de interacciones.</td>
        </tr>
    </tbody>
</table>

<h2>4.2 Flujo Contextual de Comunicación Segura</h2>
<div class="card">
    <div class="card-title">Protocolo de Interacción Cliente - Servidor - WhatsApp</div>
    <p>
    1. El usuario envía una consulta al número corporativo de Hidrosys EC.<br>
    2. El evento es interceptado por el módulo Baileys en el servidor Express.<br>
    3. El motor de flujos (<code>whatsapp/flows.js</code>) evalúa el texto y retorna el menú plano estructurado.<br>
    4. Las solicitudes administrativas web viajan mediante peticiones HTTP seguras con cabecera <code>x-session-token</code>.
    </p>
</div>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 5: CASOS DE USO DE ESCENARIO
# -------------------------------------------------------------------------
DOC5_CONTENT = """
<h1>5. CASOS DE USO DE ESCENARIO (ESCENARIOS OPERATIVOS)</h1>
<p>
Los escenarios describen las trayectorias concretas (flujos normales, alternativos y de excepción) que ocurren durante la ejecución de los casos de uso críticos en <strong>Hidrosys EC.</strong>
</p>

<h2>5.1 Escenario 1: Agendamiento Exitoso y Gestión de Cita</h2>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Fase del Escenario</th>
            <th>Descripción Operativa</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Escenario Principal (Happy Path)</strong></td>
            <td>
                1. Cliente escribe "Hola" al WhatsApp de Hidrosys.<br>
                2. El bot responde instantáneamente con las opciones numeradas (1. Agendar Cita, 2. Consultar Cobertura, 3. Soporte).<br>
                3. Cliente envía "1". El bot solicita su Nombre.<br>
                4. Cliente envía "Carlos Mendoza". El bot solicita Dirección.<br>
                5. Cliente envía "Av. Solano y Diez de Agosto". El bot solicita Fecha y Hora.<br>
                6. El bot confirma y registra la cita en la base de datos con estado <em>Pendiente</em>.
            </td>
        </tr>
        <tr>
            <td><strong>Escenario Alternativo (Dato erróneo)</strong></td>
            <td>Si el cliente ingresa un número fuera de rango en el menú principal (ej. "9"), el bot indica la lista válida de opciones de forma clara.</td>
        </tr>
    </tbody>
</table>

<h2>5.2 Escenario 2: Reconexión Rápida de WhatsApp tras Reinicio del Móvil</h2>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Fase del Escenario</th>
            <th>Descripción Operativa</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Contexto de Excepción</strong></td>
            <td>El teléfono celular de la empresa se queda sin batería o se cierra la sesión web por actualización de WhatsApp.</td>
        </tr>
        <tr>
            <td><strong>Resolución Administrativa</strong></td>
            <td>
                1. El Administrador entra a <code>http://localhost:3000</code> y va a la pestaña <strong>📱 Escanear QR / WhatsApp</strong>.<br>
                2. El sistema detecta el estado <em>Desconectado</em>.<br>
                3. El Administrador pulsa en <strong>🔄 Reiniciar Conexión / Generar Nuevo QR</strong>.<br>
                4. Escanea el código QR fresco con el móvil en segundos, recuperando el 100% de la operatividad del bot.
            </td>
        </tr>
    </tbody>
</table>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 6: REQUISITOS FUNCIONALES Y NO FUNCIONALES
# -------------------------------------------------------------------------
DOC6_CONTENT = """
<h1>6. ESPECIFICACIÓN DE REQUISITOS FUNCIONALES Y NO FUNCIONALES</h1>
<p>
El presente catálogo de requisitos formaliza las características obligatorias de ingeniería de software implementadas en el sistema integral <strong>Hidrosys EC.</strong>
</p>

<h2>6.1 Requisitos Funcionales (RF)</h2>
<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Módulo</th>
            <th>Descripción Técnica del Requisito</th>
            <th>Prioridad</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>RF-01</strong></td>
            <td>WhatsApp Bot</td>
            <td>El bot debe responder con un menú en texto numerado 100% compatible con cualquier dispositivo móvil (Android, iOS, Web).</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-02</strong></td>
            <td>Agendamiento</td>
            <td>El bot debe capturar paso a paso: Nombre, Dirección, Servicio requerido y Horario del cliente y persistirlo en base de datos.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-03</strong></td>
            <td>Panel Web (QR)</td>
            <td>El sistema web debe poseer la pestaña <code>📱 Escanear QR / WhatsApp</code> para visualizar el código QR en tiempo real y conocer el estado de sesión de Baileys.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-04</strong></td>
            <td>Seguridad API</td>
            <td>El middleware <code>requireAuth</code> debe verificar la presencia y validez del encabezado <code>x-session-token</code> en los endpoints administrativos.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-05</strong></td>
            <td>Administración</td>
            <td>El panel debe permitir crear, editar, eliminar y actualizar el estado de las citas y órdenes de trabajo del negocio.</td>
            <td>Alta</td>
        </tr>
        <tr>
            <td><strong>RF-06</strong></td>
            <td>Reportes</td>
            <td>El administrador debe poder exportar el registro técnico en formato PDF oficial y hojas de cálculo Excel.</td>
            <td>Media</td>
        </tr>
    </tbody>
</table>

<h2>6.2 Requisitos No Funcionales (RNF)</h2>
<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Categoría</th>
            <th>Especificación y Estándar de Calidad</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>RNF-01</strong></td>
            <td>Usabilidad UI/UX</td>
            <td>El panel web debe seguir los estándares de diseño premium moderno, paleta institucional ISTA/Hidrosys, tipografía Google Inter/Outfit y capacidad responsive.</td>
        </tr>
        <tr>
            <td><strong>RNF-02</strong></td>
            <td>Rendimiento</td>
            <td>El tiempo de respuesta del servidor API ante las peticiones del bot o panel web no debe superar los 250 milisegundos.</td>
        </tr>
        <tr>
            <td><strong>RNF-03</strong></td>
            <td>Compatibilidad Universal</td>
            <td>El menú del bot no debe depender de plantillas cerradas de Meta Cloud API para evitar bloqueos en celulares que no procesan botones interactivos.</td>
        </tr>
        <tr>
            <td><strong>RNF-04</strong></td>
            <td>Seguridad y Cifrado</td>
            <td>Toda comunicación del panel web con el backend debe protegerse y aislar las sesiones administrativas de las peticiones públicas.</td>
        </tr>
    </tbody>
</table>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 7: DIAGRAMAS DE ACTIVIDADES Y FLUJOS
# -------------------------------------------------------------------------
DOC7_CONTENT = """
<h1>7. DIAGRAMAS DE ACTIVIDADES Y FLUJOS DEL SISTEMA</h1>
<p>
Los diagramas de actividades ilustran la secuencia lógica y concurrente de los procesos clave dentro del ecosistema de <strong>Hidrosys EC.</strong>
</p>

<h2>7.1 Flujo de Actividad: Escaneo y Sincronización QR desde Panel Web</h2>
<div class="diagram-box">
    <svg width="600" height="310" viewBox="0 0 600 310">
        <!-- Inicio -->
        <circle cx="300" cy="25" r="12" fill="#002e6e"/>
        <line x1="300" y1="37" x2="300" y2="60" stroke="#334155" stroke-width="2"/>

        <!-- Paso 1 -->
        <rect x="160" y="60" width="280" height="40" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="300" y="85" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">1. Administrador abre pestaña "Escanear QR"</text>
        <line x1="300" y1="100" x2="300" y2="125" stroke="#334155" stroke-width="2"/>

        <!-- Rombo decisión -->
        <polygon points="300,125 380,160 300,195 220,160" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="300" y="163" font-size="10.5" font-weight="bold" fill="#92400e" text-anchor="middle">¿Bot ya conectado?</text>

        <!-- Rama Si -->
        <line x1="380" y1="160" x2="480" y2="160" stroke="#10b981" stroke-width="2"/>
        <text x="430" y="152" font-size="10" font-weight="bold" fill="#065f46">SÍ</text>
        <rect x="420" y="180" width="160" height="45" rx="6" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="500" y="207" font-size="10.5" font-weight="bold" fill="#065f46" text-anchor="middle">Mostrar: Conectado ✅</text>

        <!-- Rama No -->
        <line x1="300" y1="195" x2="300" y2="220" stroke="#2563eb" stroke-width="2"/>
        <text x="312" y="210" font-size="10" font-weight="bold" fill="#1e40af">NO</text>
        <rect x="160" y="220" width="280" height="45" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="300" y="247" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">2. Renderizar QR y Sincronizar con Móvil</text>
    </svg>
</div>

<h2>7.2 Flujo de Actividad: Agendamiento de Cita vía WhatsApp</h2>
<p>
1. <strong>Inicio:</strong> Cliente envía mensaje inicial al bot de Hidrosys EC.<br>
2. <strong>Evaluación:</strong> El bot despliega el Menú Principal con opciones numeradas.<br>
3. <strong>Selección:</strong> El cliente envía '1' para Agendar Inspección/Cita.<br>
4. <strong>Recolección de Parámetros:</strong> Sistema solicita Nombre -> Dirección -> Fecha/Hora.<br>
5. <strong>Persistencia:</strong> Creación exitosa del registro en base de datos e informando al usuario.
</p>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 8: PROBLEMAS ENCONTRADOS Y SOLUCIONES
# -------------------------------------------------------------------------
DOC8_CONTENT = """
<h1>8. ANÁLISIS DE PROBLEMAS ENCONTRADOS Y SOLUCIONES INGENIERILES</h1>
<p>
Durante las fases de diseño, pruebas y despliegue del proyecto <strong>Hidrosys EC.</strong>, se identificaron desafíos técnicos que fueron resueltos aplicando buenas prácticas de desarrollo y arquitectura.
</p>

<h2>8.1 Matriz de Resolución de Problemas (Troubleshooting)</h2>
<table>
    <thead>
        <tr>
            <th style="width:25%;">Problema Detectado</th>
            <th style="width:30%;">Causa Raíz</th>
            <th>Solución de Ingeniería Aplicada</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Incompatibilidad de Botones Interactivos en WhatsApp</strong></td>
            <td>Los mensajes de tipo <code>nativeFlowMessage</code> / botones interactivos de Meta Cloud API no se renderizan en versiones de WhatsApp personalizadas o móviles sin plantillas comerciales aprobadas.</td>
            <td><strong>Migración a Menú Numérico Estructurado:</strong> Se refactorizó <code>menuPrincipal()</code> para retornar opciones claras en texto numerado (1, 2, 3), garantizando 100% de compatibilidad en cualquier cuenta o dispositivo.</td>
        </tr>
        <tr>
            <td><strong>Dependencia del Técnico para Reconexión de WhatsApp</strong></td>
            <td>Ante desconexiones o cambios en la sesión de WhatsApp del teléfono de la empresa, era necesario acceder a consola o servidor para extraer el código QR.</td>
            <td><strong>Creación de Pestaña "📱 Escanear QR / WhatsApp":</strong> Se implementó un panel visual de administración que consulta al backend en tiempo real, renderiza el QR en pantalla y permite reconectar en menos de 4 segundos sin tocar código.</td>
        </tr>
        <tr>
            <td><strong>Protección de Endpoints de Control del Servidor</strong></td>
            <td>Endpoints como <code>POST /api/wa/restart</code> podían ser invocados de manera desprotegida si no se validaban sesiones de usuario.</td>
            <td><strong>Implementación de Middleware requireAuth:</strong> Se protegió el servidor verificando el encabezado de seguridad <code>x-session-token</code> ante cada petición sensible de administración.</td>
        </tr>
    </tbody>
</table>
"""

# -------------------------------------------------------------------------
# DOCUMENTO 9: MOCKUPS Y PROTOTIPOS DEL SISTEMA
# -------------------------------------------------------------------------
DOC9_CONTENT = """
<h1>9. MOCKUPS Y PROTOTIPO ALTA FIDELIDAD DEL SISTEMA</h1>
<p>
El prototipo visual de <strong>Hidrosys EC.</strong> refleja un estándar de diseño web moderno, tipografía institucional y una experiencia de usuario optimizada tanto para los clientes en WhatsApp como para los operadores en el Dashboard Web.
</p>

<h2>9.1 Diseño y Vistas de la Interfaz Web (Dashboard)</h2>
<div class="card">
    <div class="card-title">Vista Principal: Panel de Control y Pestaña "📱 Escanear QR / WhatsApp"</div>
    <p>
    El menú lateral de navegación integra de forma destacada la opción de vinculación QR. La interfaz presenta tarjetas de estado en colores verdes e indicadores instantáneos que muestran:
    </p>
    <ul>
        <li><strong>Estado del Bot:</strong> "¡Dispositivo Conectado! ✅" o "Código QR Listo para Escanear".</li>
        <li><strong>Botón de Acción Rápida:</strong> "🔄 Reiniciar Conexión / Generar Nuevo QR" protegido por autenticación de administrador.</li>
        <li><strong>Gestión de Citas:</strong> Tabla interactiva con filtros para citas pendientes, confirmadas y completadas.</li>
    </ul>
</div>

<h2>9.2 Diseño del Flujo en WhatsApp Asistente Virtual</h2>
<div class="card" style="background:#f0fdf4; border-color:#86efac;">
    <div class="card-title" style="color:#166534;">Simulación Real de Interacción en Chat de WhatsApp</div>
    <p style="font-family:monospace; font-size:9.5pt; color:#14532d;">
    <strong>Cliente:</strong> Hola<br><br>
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
    print(f"Iniciando generación de {len(DOCS)} informes oficiales separados...")
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
