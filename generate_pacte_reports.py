# -*- coding: utf-8 -*-
"""
Generador Oficial de los 9 Informes PACTE - HIDROSYS EC.
Con Plantillas Institucionales Oficiales del ISTA para:
1. Historias de Usuario
2. Casos de Uso y Escenarios
3. Requisitos Funcionales y No Funcionales
Autor: Freddy Peñafiel | Tutor: Ing. Fabricio Lucero
"""

import os
import subprocess

OUTPUT_DIR = r"C:\Users\fredd\.gemini\antigravity\scratch\hidrosys-system\INFORMES_PACTE_SEPARADOS"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# SVG Actores UML
def svg_actor(x, y, label, role_sub="", color="#002e6e"):
    return f"""
    <g transform="translate({x}, {y})">
        <circle cx="0" cy="-35" r="14" fill="{color}" stroke="#1e40af" stroke-width="2.5"/>
        <line x1="0" y1="-21" x2="0" y2="16" stroke="{color}" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="-22" y1="-7" x2="22" y2="-7" stroke="{color}" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="0" y1="16" x2="-18" y2="44" stroke="{color}" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="0" y1="16" x2="18" y2="44" stroke="{color}" stroke-width="3.5" stroke-linecap="round"/>
        <text x="0" y="64" font-family="'Outfit', sans-serif" font-size="12" font-weight="800" fill="#0f172a" text-anchor="middle">{label}</text>
        <text x="0" y="79" font-family="'Inter', sans-serif" font-size="9.5" font-weight="600" fill="#475569" text-anchor="middle">{role_sub}</text>
    </g>
    """

# Encabezado Institucional Oficial (3 columnas: Logo ISTA | Título | Logo Carrera)
def render_official_header(title_center):
    return f"""
    <div style="border: 2px solid #002e6e; margin: 18px 0 14px 0; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
        <table style="width: 100%; border-collapse: collapse; margin: 0;">
            <tr>
                <td style="width: 28%; text-align: left; vertical-align: middle; padding: 12px; background: #ffffff; border-right: 1.5px solid #002e6e;">
                    <div style="display: flex; align-items: center;">
                        <svg width="45" height="45" viewBox="0 0 100 100" style="margin-right:8px;">
                            <path d="M10,20 Q10,10 50,10 Q90,10 90,20 L90,60 Q90,90 50,95 Q10,90 10,60 Z" fill="#002e6e" stroke="#ffffff" stroke-width="2"/>
                            <path d="M20,40 Q35,35 50,40 Q65,45 80,40" fill="none" stroke="#2563eb" stroke-width="4"/>
                            <path d="M20,55 Q35,50 50,55 Q65,60 80,55" fill="none" stroke="#60a5fa" stroke-width="4"/>
                        </svg>
                        <div style="line-height: 1.1;">
                            <span style="font-family:'Outfit',sans-serif; font-size:9.5pt; font-weight:800; color:#002e6e; display:block;">INSTITUTO SUPERIOR</span>
                            <span style="font-family:'Outfit',sans-serif; font-size:9.5pt; font-weight:800; color:#002e6e; display:block;">TECNOLÓGICO</span>
                            <span style="font-family:'Outfit',sans-serif; font-size:9.5pt; font-weight:800; color:#002e6e; display:block;">DEL AUSTRO</span>
                        </div>
                    </div>
                </td>
                <td style="width: 44%; text-align: center; vertical-align: middle; padding: 12px; background: #ffffff; border-right: 1.5px solid #002e6e;">
                    <span style="font-family:'Outfit',sans-serif; font-size: 13pt; font-weight: 800; color: #002e6e; text-transform: uppercase;">
                        {title_center}
                    </span>
                </td>
                <td style="width: 28%; text-align: center; vertical-align: middle; padding: 12px; background: #ffffff;">
                    <div style="display: inline-block; text-align: center;">
                        <svg width="40" height="40" viewBox="0 0 100 100">
                            <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="none" stroke="#ea580c" stroke-width="8"/>
                            <text x="50" y="60" font-family="'Outfit',sans-serif" font-size="32" font-weight="bold" fill="#002e6e" text-anchor="middle">DS</text>
                        </svg>
                        <span style="display:block; font-family:'Outfit',sans-serif; font-size:8pt; font-weight:800; color:#475569; letter-spacing:0.5px; margin-top:2px;">DESARROLLO DE</span>
                        <span style="display:block; font-family:'Outfit',sans-serif; font-size:8.5pt; font-weight:800; color:#0f172a;">SOFTWARE</span>
                    </div>
                </td>
            </tr>
        </table>
    </div>
    """

# Ficha Oficial Institucional para Historia de Usuario
def render_hu_card(id_hu, titulo, descripcion, estimacion, prioridad, dependiente, pruebas_list):
    pruebas_html = "<ol style='margin-left: 18px; margin-top:4px; margin-bottom:4px;'>" + "".join([f"<li style='margin-bottom:6px;'>{p}</li>" for p in pruebas_list]) + "</ol>"
    return f"""
    {render_official_header("DESCRIPCIÓN DE<br>HISTORIAS DE USUARIO")}
    <table class="official-hu-table" style="width:100%; border:2px solid #002e6e; border-collapse:collapse; margin-bottom:22px; page-break-inside:avoid;">
        <tr style="border-bottom:1.5px solid #002e6e;">
            <td style="width:18%; background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:8px 10px;">ID:</td>
            <td style="width:15%; font-weight:800; color:#0f172a; border-right:1px solid #cbd5e1; padding:8px 10px;">{id_hu}</td>
            <td style="width:18%; background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:8px 10px;">Título:</td>
            <td style="font-weight:700; color:#0f172a; padding:8px 10px;">{titulo}</td>
        </tr>
        <tr style="border-bottom:1.5px solid #002e6e;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:10px;">Descripción:</td>
            <td colspan="3" style="padding:10px; line-height:1.5; color:#334155;">{descripcion}</td>
        </tr>
        <tr style="border-bottom:1.5px solid #002e6e;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:8px 10px;">Estimación:</td>
            <td style="border-right:1px solid #cbd5e1; padding:8px 10px;">{estimacion}</td>
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:8px 10px;">Prioridad: {prioridad}</td>
            <td style="padding:8px 10px;"><strong>Dependiente de:</strong> {dependiente}</td>
        </tr>
        <tr>
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:10px;">Pruebas de<br>aceptación:</td>
            <td colspan="3" style="padding:10px;">{pruebas_html}</td>
        </tr>
    </table>
    """

# Ficha Oficial Institucional para Caso de Uso / Escenario
def render_uc_card(nombre, descripcion, actores, precondiciones, flujo_normal, flujo_alt, postcondiciones, reglas, rnf, comentarios):
    return f"""
    {render_official_header("DESCRIPCIÓN DE CASOS<br>DE USO - ESCENARIOS")}
    <table class="official-uc-table" style="width:100%; border:2px solid #002e6e; border-collapse:collapse; margin-bottom:24px; page-break-inside:avoid;">
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="width:25%; background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Área o Departamento:</td>
            <td colspan="3" style="padding:7px 10px;">Gestión de Proyectos y Sistemas - Hidrosys EC.</td>
        </tr>
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Elaborado por:</td>
            <td style="width:35%; padding:7px 10px; border-right:1px solid #cbd5e1;">Freddy Peñafiel – Desarrollador Principal</td>
            <td style="width:18%; background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Fecha:</td>
            <td style="padding:7px 10px;">Julio de 2026</td>
        </tr>
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Nombre:</td>
            <td colspan="3" style="padding:7px 10px; font-weight:700; color:#0f172a;">{nombre}</td>
        </tr>
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Descripción:</td>
            <td colspan="3" style="padding:8px 10px; text-align:justify;">{descripcion}</td>
        </tr>
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Actores:</td>
            <td colspan="3" style="padding:7px 10px; font-weight:600;">{actores}</td>
        </tr>
        <tr style="border-bottom:1.5px solid #002e6e;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Precondiciones:</td>
            <td colspan="3" style="padding:7px 10px;">{precondiciones}</td>
        </tr>
        <tr style="border-bottom:1.5px solid #002e6e;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:10px;">Flujo Normal:</td>
            <td colspan="3" style="padding:10px; line-height:1.5;">{flujo_normal}</td>
        </tr>
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:10px;">Flujo alternativo:</td>
            <td colspan="3" style="padding:10px; line-height:1.5; color:#475569;">{flujo_alt}</td>
        </tr>
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Postcondiciones:</td>
            <td colspan="3" style="padding:7px 10px;">{postcondiciones}</td>
        </tr>
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Reglas de Negocio:</td>
            <td colspan="3" style="padding:7px 10px;">{reglas}</td>
        </tr>
        <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Requerimientos No Funcionales:</td>
            <td colspan="3" style="padding:7px 10px;">{rnf}</td>
        </tr>
        <tr>
            <td style="background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:7px 10px;">Comentarios o Enlaces:</td>
            <td colspan="3" style="padding:7px 10px;">{comentarios}</td>
        </tr>
    </table>
    """

# Ficha Oficial Institucional para Requisitos Funcionales y No Funcionales
def render_req_table(rows_list):
    header_html = render_official_header("Requisitos Funcionales y No<br>Funcionales")
    meta_bar = """
    <table style="width:100%; border:2px solid #002e6e; border-collapse:collapse; margin-bottom:0px;">
        <tr style="border-bottom:2px solid #002e6e;">
            <td style="width:18%; background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:8px 10px;">Área o Departamento:</td>
            <td style="width:36%; padding:8px 10px; border-right:1px solid #cbd5e1;">Sistemas - Proyecto Hidrosys EC.</td>
            <td style="width:14%; background:#f1f5f9; font-weight:700; color:#002e6e; border-right:1px solid #cbd5e1; padding:8px 10px;">Elaborado por:</td>
            <td style="width:20%; padding:8px 10px; border-right:1px solid #cbd5e1;">Freddy Peñafiel</td>
            <td style="width:12%; padding:8px 10px;"><strong>Fecha:</strong> Julio 2026</td>
        </tr>
    </table>
    """
    rows_html = ""
    for id_req, desc, cu_rel, hu_rel, crit, estado in rows_list:
        rows_html += f"""
        <tr>
            <td style="font-weight:800; color:#0f172a; border:1px solid #cbd5e1; padding:8px; text-align:center;">{id_req}</td>
            <td style="border:1px solid #cbd5e1; padding:8px; text-align:justify;">{desc}</td>
            <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">{cu_rel}</td>
            <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">{hu_rel}</td>
            <td style="border:1px solid #cbd5e1; padding:8px; text-align:justify;">{crit}</td>
            <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; font-weight:700;">{estado}</td>
        </tr>
        """
    return f"""
    {header_html}
    {meta_bar}
    <table style="width:100%; border:2px solid #002e6e; border-top:none; border-collapse:collapse; margin-bottom:22px;">
        <thead>
            <tr style="background:#002e6e; color:white;">
                <th style="width:9%; padding:8px; border:1px solid #cbd5e1; text-align:center;">Id</th>
                <th style="width:28%; padding:8px; border:1px solid #cbd5e1;">Descripción del Requisito</th>
                <th style="width:16%; padding:8px; border:1px solid #cbd5e1; text-align:center;">Caso de Uso Relacionado</th>
                <th style="width:15%; padding:8px; border:1px solid #cbd5e1; text-align:center;">Historia de Usuario Relacionada</th>
                <th style="width:22%; padding:8px; border:1px solid #cbd5e1;">Criterios de Aceptación</th>
                <th style="width:10%; padding:8px; border:1px solid #cbd5e1; text-align:center;">Estado</th>
            </tr>
        </thead>
        <tbody>
            {rows_html}
        </tbody>
    </table>
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
                    <div class="cover-subtitle-univ">CARRERA DE TECNOLOGÍA SUPERIOR EN DESARROLLO DE SOFTWARE</div>
                </div>
            </div>
            
            <div class="cover-meta-grid">
                <div class="meta-box">
                    <span class="meta-label">PROYECTO DE TITULACIÓN / PACTE</span>
                    <span class="meta-value">ARQUITECTURA E INGENIERÍA DE SOFTWARE</span>
                </div>
                <div class="meta-box">
                    <span class="meta-label">PERIODO ACADÉMICO</span>
                    <span class="meta-value">CICLO 2026 - CUENCA, ECUADOR</span>
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
                    <span class="author-desc">Analista y Desarrollador Principal • Hidrosys EC.</span>
                </div>
                <div class="author-card">
                    <span class="author-role">DOCENTE / TUTOR ACADÉMICO</span>
                    <span class="author-name">Ing. Fabricio Lucero</span>
                    <span class="author-desc">Director y Tutor del Proyecto PACTE • ISTA</span>
                </div>
            </div>
            <div class="cover-date">Instituto Superior Tecnológico del Austro • 2026</div>
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
        --accent: #2563eb;
        --ista-blue: #002e6e;
        --success: #10b981;
        --warning: #f59e0b;
        --danger: #ef4444;
        --gray-100: #f8fafc;
        --gray-200: #e2e8f0;
        --gray-700: #334155;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--gray-700);
        line-height: 1.55;
        background: white;
        font-size: 9.8pt;
    }

    .container { max-width: 100%; margin: 0 auto; }

    /* Portada */
    .cover-page {
        height: 92vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 5px 10px;
        page-break-after: always;
    }
    .cover-header { border-bottom: 3px solid var(--ista-blue); padding-bottom: 18px; }
    .cover-logo-area { display: flex; align-items: center; justify-content: center; margin-bottom: 15px; }
    .cover-title-univ { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; color: var(--ista-blue); }
    .cover-subtitle-univ { font-size: 0.88rem; font-weight: 600; color: #475569; letter-spacing: 1.5px; }
    .cover-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
    .meta-box { background: var(--gray-100); padding: 9px 12px; border-left: 4px solid var(--accent); }
    .meta-label { display: block; font-size: 0.72rem; font-weight: 700; color: #64748b; }
    .meta-value { font-size: 0.88rem; font-weight: 700; color: var(--primary); }

    .cover-center { text-align: center; padding: 25px 15px; }
    .doc-badge { display: inline-block; background: #eff6ff; color: var(--accent); font-weight: 700; font-size: 0.85rem; padding: 5px 14px; border-radius: 20px; border: 1px solid #bfdbfe; margin-bottom: 16px; }
    .cover-project-title { font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 800; color: var(--primary); line-height: 1.38; margin-bottom: 16px; }
    .cover-doc-title { font-family: 'Outfit', sans-serif; font-size: 1.65rem; font-weight: 800; color: var(--ista-blue); padding: 10px 0; border-top: 1px solid var(--gray-200); border-bottom: 1px solid var(--gray-200); margin-bottom: 14px; }
    .cover-doc-summary { font-size: 0.98rem; color: #475569; max-width: 88%; margin: 0 auto; }

    .cover-footer { border-top: 2px solid var(--gray-200); padding-top: 18px; }
    .authors-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 12px; }
    .author-card { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid var(--gray-200); }
    .author-role { display: block; font-size: 0.72rem; font-weight: 700; color: var(--accent); }
    .author-name { display: block; font-size: 1.15rem; font-weight: 800; color: var(--primary); margin: 3px 0; }
    .author-desc { font-size: 0.83rem; color: #64748b; }
    .cover-date { text-align: center; font-size: 0.88rem; font-weight: 600; color: #64748b; }

    h1, h2, h3 { font-family: 'Outfit', sans-serif; color: var(--primary); margin-top: 20px; margin-bottom: 10px; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid var(--ista-blue); padding-bottom: 6px; }
    h2 { font-size: 1.25rem; color: var(--ista-blue); }
    p { margin-bottom: 12px; text-align: justify; }

    .diagram-box { background: #ffffff; border: 2px solid var(--gray-200); border-radius: 8px; padding: 16px 10px; margin: 18px 0; text-align: center; page-break-inside: avoid; }
    .diagram-caption { font-weight: 700; font-size: 9.2pt; color: var(--ista-blue); margin-top: 10px; text-transform: uppercase; }
    .explanation-box { background: #f1f5f9; border-left: 4px solid var(--ista-blue); padding: 12px 14px; margin: 12px 0; font-size: 9.3pt; text-align: justify; }
"""

def wrap_html(doc_code, doc_title, doc_summary, content_body):
    cover = COVER_TEMPLATE.format(doc_code=doc_code, doc_title=doc_title, doc_summary=doc_summary)
    return f"""<!DOCTYPE html>
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

# =========================================================================
# DOCUMENTO 1: NECESIDADES DEL USUARIO (CON ACTORES UML DIBUJADOS)
# =========================================================================
DOC1_CONTENT = f"""
<h1>1. ANÁLISIS INTEGRAL DE NECESIDADES DEL USUARIO Y STAKEHOLDERS</h1>
<p>
El presente informe documenta en profundidad la investigación de requerimientos y necesidades operativas del proyecto <strong>Hidrosys EC.</strong>. Se analiza el ecosistema de atención para servicios de agua potable e instalaciones de gas y se articula la solución tecnológica implementada.
</p>

<h2>1.1 Diagrama UML de Actores e Interesados (Stakeholders)</h2>
<div class="diagram-box">
    <svg width="680" height="260" viewBox="0 0 680 260">
        {svg_actor(70, 75, "Cliente / Ciudadano", "Canal WhatsApp")}
        {svg_actor(70, 205, "Dueño / Super Admin", "Panel Web Principal")}
        {svg_actor(610, 75, "Operador Oficina", "Admin Secundario")}
        {svg_actor(610, 205, "Técnico de Campo", "Atención en Sitio")}

        <rect x="180" y="25" width="320" height="215" rx="14" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="340" y="55" font-family="'Outfit', sans-serif" font-size="13" font-weight="800" fill="#002e6e" text-anchor="middle">ECOSISTEMA HIDROSYS EC.</text>

        <rect x="205" y="75" width="270" height="40" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="340" y="100" font-size="10.5" font-weight="700" fill="#1e40af" text-anchor="middle">Asistente WhatsApp Bot (Menú Numérico)</text>

        <rect x="205" y="130" width="270" height="40" rx="8" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="340" y="155" font-size="10.5" font-weight="700" fill="#065f46" text-anchor="middle">Pestaña Web "Escanear QR / WhatsApp"</text>

        <rect x="205" y="185" width="270" height="40" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="340" y="210" font-size="10.5" font-weight="700" fill="#92400e" text-anchor="middle">Base de Datos & Seguridad requireAuth</text>

        <line x1="110" y1="75" x2="205" y2="95" stroke="#334155" stroke-width="2"/>
        <line x1="110" y1="205" x2="205" y2="150" stroke="#334155" stroke-width="2"/>
        <line x1="570" y1="75" x2="475" y2="150" stroke="#334155" stroke-width="2"/>
        <line x1="570" y1="205" x2="475" y2="205" stroke="#334155" stroke-width="2"/>
    </svg>
    <div class="diagram-caption">Figura 1.1 - Mapa Estructural de Actores e Interacción en Hidrosys EC.</div>
</div>
"""

# =========================================================================
# DOCUMENTO 2: HISTORIAS DE USUARIO (USANDO PLANTILLA OFICIAL ISTA)
# =========================================================================
DOC2_CONTENT = f"""
<h1>2. HISTORIAS DE USUARIO Y CICLO ÁGIL SCRUM (PLANTILLA OFICIAL)</h1>
<p>
A continuación se especifican las Historias de Usuario oficiales del proyecto <strong>Hidrosys EC.</strong>, empleando el formato formal y la plantilla institucional del Instituto Superior Tecnológico del Austro.
</p>

{render_hu_card(
    "HU-01",
    "Menú Numérico en WhatsApp 100% Confiable",
    "Como cliente o ciudadano que escribe al bot de WhatsApp de Hidrosys EC., quiero recibir un menú estructurado con opciones numeradas simples (1, 2, 3), para seleccionar mi trámite sin sufrir bloqueos ni errores de incompatibilidad en móviles.",
    "3 puntos de historia",
    "100 (Alta)",
    "Arquitectura Base Baileys Node.js",
    [
        "Al enviar 'Hola' o cualquier saludo, el bot debe responder en menos de 1.5 segundos con las opciones 1, 2 y 3 en texto plano.",
        "Si el usuario responde '1', el bot inicia el agendamiento de cita técnica.",
        "Si el usuario responde '2', el bot informa sobre zonas de cobertura.",
        "Tolerancia a entradas inválidas con mensaje orientador amable."
    ]
)}

{render_hu_card(
    "HU-02",
    "Agendamiento Guiado de Citas e Inspecciones Técnicas",
    "Como cliente que requiere revisión o mantenimiento de agua y gas, quiero ingresar paso a paso mi Nombre, Dirección, Servicio y Fecha por WhatsApp, para dejar registrada mi cita formal sin llamadas telefónicas.",
    "5 puntos de historia",
    "100 (Alta)",
    "HU-01 (Menú Principal)",
    [
        "El bot solicita de forma ordenada: Nombre Completo, Dirección Exacta, Tipo de Servicio y Fecha.",
        "Los datos ingresados se insertan en la tabla transaccional de base de datos con estado 'Pendiente'.",
        "El bot emite un comprobante formal confirmando el agendamiento exitoso."
    ]
)}

{render_hu_card(
    "HU-03",
    "Reconexión Autónoma mediante Pestaña 'Escanear QR / WhatsApp'",
    "Como Administrador Principal o Dueño de Hidrosys EC., quiero disponer de la pestaña 'Escanear QR / WhatsApp' en el panel web que muestre el QR en tiempo real, para conectar el celular corporativo al instante ante cualquier pérdida de sesión sin requerir programadores.",
    "8 puntos de historia",
    "100 (Alta)",
    "Backend Express /api/wa/status",
    [
        "El menú lateral de localhost:3000 incluye la opción '📱 Escanear QR / WhatsApp'.",
        "Si el bot está conectado, la interfaz muestra '¡Dispositivo Conectado! ✅'.",
        "Si la sesión se desconecta, se dibuja en pantalla el código QR listo para escanear.",
        "Incluye botón protegido para reiniciar y generar un nuevo QR al instante."
    ]
)}

{render_hu_card(
    "HU-04",
    "Seguridad Institucional mediante Middleware requireAuth",
    "Como Administrador del Sistema, quiero que las peticiones administrativas a la API REST verifiquen la presencia de un token de sesión, para evitar que usuarios no autorizados manipulen citas o reinicien el bot.",
    "5 puntos de historia",
    "100 (Alta)",
    "Módulo de Sesiones Express",
    [
        "El middleware requireAuth inspecciona la cabecera x-session-token en endpoints sensibles.",
        "Si el token es inválido o faltante, el servidor rechaza con HTTP 401 Unauthorized."
    ]
)}
"""

# =========================================================================
# DOCUMENTO 3: CASOS DE USO CERO Y DETALLADOS (PLANTILLA OFICIAL)
# =========================================================================
DOC3_CONTENT = f"""
<h1>3. CASOS DE USO CERO Y DETALLADOS POR ROL (PLANTILLA OFICIAL)</h1>
<p>
Este documento contiene la especificación formal de Casos de Uso del sistema <strong>Hidrosys EC.</strong> bajo el estándar oficial de ficha institucional del IST del Austro.
</p>

<h2>3.1 Diagrama de Casos de Uso Cero (Frontera con Actores UML)</h2>
<div class="diagram-box">
    <svg width="680" height="320" viewBox="0 0 680 320">
        {svg_actor(70, 85, "Cliente WhatsApp")}
        {svg_actor(70, 235, "Super Admin")}
        {svg_actor(610, 85, "Operador Oficina")}
        {svg_actor(610, 235, "Técnico Campo")}

        <rect x="160" y="20" width="360" height="280" rx="14" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="340" y="48" font-family="'Outfit', sans-serif" font-size="12.5" font-weight="800" fill="#002e6e" text-anchor="middle">SISTEMA INTEGRAL HIDROSYS EC.</text>

        <ellipse cx="340" cy="85" rx="135" ry="24" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="340" y="89" font-size="10" font-weight="700" fill="#1e40af" text-anchor="middle">UC-01: Interactuar por Menú Numérico y Agendar</text>

        <ellipse cx="340" cy="150" rx="135" ry="24" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="340" y="154" font-size="10" font-weight="700" fill="#065f46" text-anchor="middle">UC-02: Escanear QR en Vivo y Reconectar Bot</text>

        <ellipse cx="340" cy="215" rx="135" ry="24" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="340" y="219" font-size="10" font-weight="700" fill="#92400e" text-anchor="middle">UC-03: Administrar Órdenes y Asignar Cuadrillas</text>

        <line x1="105" y1="85" x2="205" y2="85" stroke="#334155" stroke-width="2"/>
        <line x1="105" y1="235" x2="205" y2="150" stroke="#334155" stroke-width="2"/>
        <line x1="575" y1="85" x2="475" y2="215" stroke="#334155" stroke-width="2"/>
    </svg>
    <div class="diagram-caption">Figura 3.1 - Diagrama UML de Casos de Uso Cero (Vista de Frontera Global)</div>
</div>

{render_uc_card(
    "CUD-01: Sincronización QR en Tiempo Real desde el Panel Web",
    "Este caso de uso describe el proceso mediante el cual el Administrador Principal o Dueño de Hidrosys EC. escanea el código QR desde su panel web para conectar en tiempo real el teléfono corporativo con el servidor de WhatsApp Bot.",
    "Dueño / Administrador Principal, Servidor Node.js (Baileys WebSocket)",
    "El administrador debe haber iniciado sesión como Super Admin y contar con sesión válida.",
    "1. El administrador accede al panel web en localhost:3000.<br>2. Hace clic en la pestaña lateral <strong>📱 Escanear QR / WhatsApp</strong>.<br>3. El sistema consulta en vivo al endpoint /api/wa/status.<br>4. Si el bot está desconectado, se renderiza el código QR en pantalla.<br>5. El administrador apunta la cámara de WhatsApp de su celular y escanea el código.<br>6. El servidor confirma la autenticación y actualiza el estado a '¡Dispositivo Conectado! ✅'.",
    "A1. Si el código QR expira antes del escaneo, el administrador hace clic en '🔄 Reiniciar Conexión / Generar Nuevo QR' para obtener un QR nuevo al instante.<br>A2. Si el dispositivo ya estaba conectado, el panel muestra directamente la tarjeta verde de conexión.",
    "El bot de WhatsApp queda conectado, sincronizado y activo para responder a clientes.",
    "Solo usuarios con rol Administrador autenticados pueden visualizar y reiniciar el servicio QR.",
    "El QR debe renderizarse en menos de 2 segundos. La sincronización se refleja automáticamente sin recargar la página.",
    "Relacionado con HU-03 y con el módulo de conexión Baileys en server.js."
)}

{render_uc_card(
    "CUD-02: Agendamiento Automático de Citas de Agua y Gas por WhatsApp",
    "Describe el proceso conversacional por el cual un ciudadano agenda una inspección técnica interactuando con el bot de WhatsApp utilizando el menú numérico estructurado.",
    "Cliente / Ciudadano, Asistente Virtual WhatsApp Bot, Base de Datos Hidrosys",
    "El bot debe encontrarse conectado al número corporativo (+593 968245633).",
    "1. El cliente envía un mensaje inicial al número corporativo.<br>2. El bot responde en &lt;1.5s mostrando las opciones numeradas (1, 2, 3).<br>3. El cliente responde con '1' (Agendar Cita).<br>4. El bot solicita paso a paso: Nombre, Dirección Exacta, Tipo de Servicio y Fecha.<br>5. El servidor inserta la cita en la tabla de base de datos con estado 'Pendiente'.<br>6. El bot envía al cliente la confirmación oficial con el resumen de la orden.",
    "A1. Si el cliente escribe un texto no numérico en el menú inicial, el bot recuerda amablemente seleccionar una opción (1, 2 o 3).",
    "La orden de trabajo queda almacenada formalmente y visible en el panel web del operador.",
    "El menú debe basarse estrictamente en números simples para garantizar compatibilidad del 100% en todos los celulares.",
    "El tiempo de respuesta entre mensajes conversacionales no debe exceder los 1.5 segundos.",
    "Relacionado con HU-01, HU-02 y el archivo whatsapp/flows.js."
)}
"""

# =========================================================================
# DOCUMENTO 4: CASOS DE USO DE CONTEXTO
# =========================================================================
DOC4_CONTENT = f"""
<h1>4. CASOS DE USO DE CONTEXTO Y ARQUITECTURA DE FRONTERA</h1>
<p>
Se presenta la arquitectura contextual e interconexión técnica del sistema <strong>Hidrosys EC.</strong>.
</p>

<h2>4.1 Diagrama de Arquitectura de Contexto</h2>
<div class="diagram-box">
    <svg width="680" height="210" viewBox="0 0 680 210">
        <rect x="25" y="60" width="130" height="85" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
        <text x="90" y="95" font-size="11" font-weight="bold" fill="#1e40af" text-anchor="middle">WhatsApp App</text>
        <text x="90" y="115" font-size="9" fill="#1e40af" text-anchor="middle">(Clientes Móviles)</text>

        <line x1="155" y1="102" x2="225" y2="102" stroke="#334155" stroke-width="2"/>

        <rect x="225" y="30" width="230" height="150" rx="12" fill="#f8fafc" stroke="#002e6e" stroke-width="2.5"/>
        <text x="340" y="60" font-size="12" font-weight="800" fill="#002e6e" text-anchor="middle">BACKEND HIDROSYS EC.</text>
        <rect x="245" y="75" width="190" height="34" rx="6" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="340" y="97" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">Baileys WebSocket / QR Stream</text>
        <rect x="245" y="120" width="190" height="34" rx="6" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="340" y="142" font-size="10" font-weight="bold" fill="#92400e" text-anchor="middle">API REST Express & requireAuth</text>

        <line x1="455" y1="102" x2="525" y2="102" stroke="#334155" stroke-width="2"/>

        <rect x="525" y="60" width="130" height="85" rx="8" fill="#f3e8ff" stroke="#7e22ce" stroke-width="2"/>
        <text x="590" y="95" font-size="11" font-weight="bold" fill="#6b21a8" text-anchor="middle">Base de Datos</text>
        <text x="590" y="115" font-size="9" fill="#6b21a8" text-anchor="middle">& Panel Web Admin</text>
    </svg>
    <div class="diagram-caption">Figura 4.1 - Interfaz y Fronteras del Ecosistema Hidrosys EC.</div>
</div>
"""

# =========================================================================
# DOCUMENTO 5: CASOS DE USO DE ESCENARIO (PLANTILLA OFICIAL)
# =========================================================================
DOC5_CONTENT = f"""
<h1>5. CASOS DE USO DE ESCENARIO Y DIAGRAMAS DE SECUENCIA (PLANTILLA OFICIAL)</h1>
<p>
A continuación se documentan los escenarios operativos clave utilizando la plantilla oficial institucional.
</p>

<h2>5.1 Diagrama de Secuencia: Escenario de Conexión QR en Panel Web</h2>
<div class="diagram-box">
    <svg width="660" height="220" viewBox="0 0 660 220">
        <rect x="30" y="20" width="120" height="35" rx="6" fill="#002e6e"/>
        <text x="90" y="42" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Dueño / Admin</text>
        <line x1="90" y1="55" x2="90" y2="200" stroke="#64748b" stroke-dasharray="4"/>

        <rect x="210" y="20" width="130" height="35" rx="6" fill="#2563eb"/>
        <text x="275" y="42" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Panel Web (UI)</text>
        <line x1="275" y1="55" x2="275" y2="200" stroke="#64748b" stroke-dasharray="4"/>

        <rect x="410" y="20" width="130" height="35" rx="6" fill="#10b981"/>
        <text x="475" y="42" font-size="10.5" font-weight="bold" fill="white" text-anchor="middle">Servidor Express</text>
        <line x1="475" y1="55" x2="475" y2="200" stroke="#64748b" stroke-dasharray="4"/>

        <line x1="90" y1="85" x2="275" y2="85" stroke="#002e6e" stroke-width="2"/>
        <text x="182" y="78" font-size="9" fill="#002e6e" text-anchor="middle">1. Clic "📱 Escanear QR"</text>

        <line x1="275" y1="120" x2="475" y2="120" stroke="#2563eb" stroke-width="2"/>
        <text x="375" y="113" font-size="9" fill="#2563eb" text-anchor="middle">2. GET /api/wa/status</text>

        <line x1="475" y1="160" x2="90" y2="160" stroke="#10b981" stroke-width="2"/>
        <text x="282" y="153" font-size="9.5" font-weight="bold" fill="#065f46" text-anchor="middle">3. Render QR -> Escaneo -> ¡Dispositivo Conectado! ✅</text>
    </svg>
    <div class="diagram-caption">Figura 5.1 - Secuencia de Comunicación Transaccional del Módulo QR</div>
</div>

{render_uc_card(
    "ESC-01: Auditoría y Confirmación Operativa de Órdenes de Trabajo en Oficina",
    "Describe el escenario donde el operador accede al panel de administración para auditar, asignar técnicos y confirmar las citas generadas por los clientes vía WhatsApp.",
    "Administrador Secundario (Operador), Dashboard Web Hidrosys EC.",
    "Sesión iniciada con credenciales válidas en el panel administrativo.",
    "1. El operador ingresa a la pestaña 📅 Gestión de Citas.<br>2. Filtra la lista por estado 'Pendiente'.<br>3. Revisa el Nombre, Dirección y Fecha solicitada por el cliente.<br>4. Asigna el equipo técnico de campo responsable.<br>5. Cambia el estado a 'Confirmada' y guarda transaccionalmente.",
    "A1. Si la dirección es incompleta, el operador se comunica al número de WhatsApp del cliente desde el panel para complementar los datos.",
    "La orden queda lista y programada en la agenda de ejecución.",
    "Solo operadores y administradores pueden modificar estados de citas.",
    "La consulta de la tabla filtrada no excederá los 1.5 segundos.",
    "Relacionado con HU-06 y el módulo de base de datos."
)}
"""

# =========================================================================
# DOCUMENTO 6: REQUISITOS FUNCIONALES Y NO FUNCIONALES (PLANTILLA OFICIAL)
# =========================================================================
REQ_ROWS = [
    ("RF-01", "El sistema debe desplegar al usuario un menú de bienvenida estructurado con opciones numeradas en texto plano ('1', '2', '3'), asegurando 100% de compatibilidad sin botones flotantes.", "CUD-02 (Agendar Cita)", "HU-01 (Menú WhatsApp)", "Se acepta si el bot responde en <1.5s mostrando correctamente las opciones 1, 2 y 3.", "Alta"),
    ("RF-02", "El bot debe procesar secuencialmente los datos de la cita (Nombre, Dirección, Fecha y Servicio) e insertarlos en la base de datos.", "CUD-02 (Agendar Cita)", "HU-02 (Agendamiento)", "Aceptado si la orden queda registrada transaccionalmente en estado 'Pendiente'.", "Alta"),
    ("RF-03", "El panel web debe contar con la pestaña '📱 Escanear QR / WhatsApp' para mostrar el estado en vivo del bot y renderizar el código QR.", "CUD-01 (Escanear QR)", "HU-03 (Reconexión QR)", "Aceptado si muestra '¡Dispositivo Conectado! ✅' o dibuja el QR sincronizado en vivo.", "Alta"),
    ("RF-04", "El middleware requireAuth de Express debe validar la cabecera x-session-token antes de autorizar peticiones sensibles.", "CUD-01 (Escanear QR)", "HU-04 (Seguridad API)", "Aceptado si una petición sin token es rechazada con HTTP 401 Unauthorized.", "Alta"),
    ("RF-05", "El panel de control debe permitir al operador listar, filtrar por estados y actualizar las órdenes de trabajo de los clientes.", "ESC-01 (Auditar Citas)", "HU-06 (Gestión Citas)", "Aceptado si los filtros y cambios de estado se guardan en menos de 2 segundos.", "Alta"),
    ("RNF-01", "La interfaz del panel web debe cumplir con diseño moderno y estético, utilizando tipografía Outfit/Inter y alta adaptabilidad.", "Todos los módulos", "HU-03, HU-06", "Aceptado si el diseño se adapta perfectamente a pantallas de escritorio y móviles.", "Alta"),
    ("RNF-02", "El tiempo de respuesta del servidor API ante las interacciones conversacionales de WhatsApp no superará los 250 milisegundos.", "CUD-02 (Agendar Cita)", "HU-01, HU-02", "Aceptado si las métricas de latencia demuestran respuesta inmediata.", "Alta"),
    ("RNF-03", "El sistema debe garantizar alta disponibilidad del bot y autogestión de reconexión sin depender de programadores externos.", "CUD-01 (Escanear QR)", "HU-03 (Reconexión QR)", "Aceptado si el dueño puede escanear y conectar el bot de manera autónoma en 3 segundos.", "Alta")
]

DOC6_CONTENT = f"""
<h1>6. REQUISITOS FUNCIONALES Y NO FUNCIONALES (PLANTILLA OFICIAL ISTA)</h1>
<p>
A continuación se especifican los requerimientos técnicos oficiales en el formato institucional de tabla y membrete del Instituto Superior Tecnológico del Austro.
</p>

{render_req_table(REQ_ROWS)}
"""

# =========================================================================
# DOCUMENTO 7: DIAGRAMAS DE ACTIVIDADES Y FLUJOS
# =========================================================================
DOC7_CONTENT = f"""
<h1>7. DIAGRAMAS DE ACTIVIDADES Y FLUJOS OPERATIVOS (BPMN)</h1>
<p>Se documentan las secuencias lógicas del sistema Hidrosys EC.</p>
<h2>7.1 Flujograma BPMN: Reconexión QR desde el Panel Web</h2>
<div class="diagram-box">
    <svg width="660" height="260" viewBox="0 0 660 260">
        <circle cx="330" cy="22" r="11" fill="#002e6e"/>
        <line x1="330" y1="33" x2="330" y2="55" stroke="#334155" stroke-width="2"/>
        <rect x="175" y="55" width="310" height="38" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="330" y="78" font-size="10.5" font-weight="bold" fill="#1e40af" text-anchor="middle">1. Abrir Pestaña "📱 Escanear QR / WhatsApp"</text>
        <line x1="330" y1="93" x2="330" y2="115" stroke="#334155" stroke-width="2"/>
        <polygon points="330,115 410,145 330,175 250,145" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
        <text x="330" y="149" font-size="10" font-weight="bold" fill="#92400e" text-anchor="middle">¿Bot Conectado?</text>
        <line x1="410" y1="145" x2="490" y2="145" stroke="#10b981" stroke-width="2"/>
        <text x="445" y="138" font-size="9.5" font-weight="bold" fill="#065f46">SÍ</text>
        <rect x="490" y="125" width="145" height="40" rx="6" fill="#d1fae5" stroke="#065f46" stroke-width="1.5"/>
        <text x="562" y="149" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">Conectado ✅</text>
        <line x1="330" y1="175" x2="330" y2="205" stroke="#2563eb" stroke-width="2"/>
        <text x="342" y="192" font-size="9.5" font-weight="bold" fill="#1e40af">NO</text>
        <rect x="175" y="205" width="310" height="42" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
        <text x="330" y="230" font-size="10.5" font-weight="bold" fill="#1e40af" text-anchor="middle">2. Renderizar QR y Vincular con WhatsApp</text>
    </svg>
    <div class="diagram-caption">Figura 7.1 - Flujo de Actividad BPMN de Conexión QR</div>
</div>
"""

# =========================================================================
# DOCUMENTO 8: PROBLEMAS ENCONTRADOS Y SOLUCIONES
# =========================================================================
DOC8_CONTENT = f"""
<h1>8. CASOS DE ESTUDIO: PROBLEMAS ENCONTRADOS Y SOLUCIONES</h1>
<p>Análisis técnico comparativo de las mitigaciones aplicadas en Hidrosys EC.</p>
<h2>8.1 Comparativa Antes vs. Después</h2>
<div class="diagram-box">
    <svg width="660" height="180" viewBox="0 0 660 180">
        <rect x="30" y="30" width="280" height="120" rx="10" fill="#fef2f2" stroke="#ef4444" stroke-width="2"/>
        <text x="170" y="60" font-size="11.5" font-weight="bold" fill="#b91c1c" text-anchor="middle">PROBLEMA ANTERIOR</text>
        <text x="170" y="88" font-size="9.5" fill="#991b1b" text-anchor="middle">• Botones interactivos bloqueados</text>
        <text x="170" y="112" font-size="9.5" fill="#991b1b" text-anchor="middle">• Dependencia para escanear QR</text>

        <line x1="320" y1="90" x2="350" y2="90" stroke="#002e6e" stroke-width="3"/>

        <rect x="360" y="30" width="270" height="120" rx="10" fill="#f0fdf4" stroke="#10b981" stroke-width="2"/>
        <text x="495" y="60" font-size="11.5" font-weight="bold" fill="#166534" text-anchor="middle">SOLUCIÓN HIDROSYS v3.0</text>
        <text x="495" y="88" font-size="9.5" fill="#14532d" text-anchor="middle">• Menú Numérico 100% confiable</text>
        <text x="495" y="112" font-size="9.5" fill="#14532d" text-anchor="middle">• Pestaña "📱 Escanear QR" autónoma</text>
    </svg>
    <div class="diagram-caption">Figura 8.1 - Soluciones de Arquitectura e Interfaz Implementadas</div>
</div>
"""

# =========================================================================
# DOCUMENTO 9: MOCKUPS Y PROTOTIPOS DEL SISTEMA
# =========================================================================
DOC9_CONTENT = f"""
<h1>9. MOCKUPS Y PROTOTIPOS ALTA FIDELIDAD DEL SISTEMA</h1>
<p>Diseño visual esquemático de interfaces gráficas de Hidrosys EC.</p>
<h2>9.1 Mockup UI: Pestaña "📱 Escanear QR / WhatsApp" en Panel Web</h2>
<div class="diagram-box">
    <svg width="660" height="230" viewBox="0 0 660 230">
        <rect x="30" y="15" width="600" height="200" rx="8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
        <rect x="30" y="15" width="600" height="28" rx="8" fill="#002e6e"/>
        <text x="50" y="33" font-size="10" font-weight="bold" fill="white">HIDROSYS EC. • Panel de Administración Web</text>
        <rect x="30" y="43" width="150" height="172" fill="#1e293b"/>
        <text x="45" y="75" font-size="9.5" fill="#cbd5e1">📊 Dashboard</text>
        <text x="45" y="105" font-size="9.5" fill="#cbd5e1">📅 Citas Médicas</text>
        <rect x="35" y="125" width="140" height="26" rx="4" fill="#2563eb"/>
        <text x="45" y="142" font-size="9.5" font-weight="bold" fill="white">📱 Escanear QR</text>
        <rect x="200" y="60" width="410" height="140" rx="8" fill="white" stroke="#cbd5e1"/>
        <text x="220" y="88" font-size="12" font-weight="bold" fill="#002e6e">Conexión en Vivo con WhatsApp Bot</text>
        <rect x="220" y="105" width="180" height="35" rx="6" fill="#d1fae5" stroke="#065f46"/>
        <text x="310" y="127" font-size="10" font-weight="bold" fill="#065f46" text-anchor="middle">¡Dispositivo Conectado! ✅</text>
    </svg>
    <div class="diagram-caption">Figura 9.1 - Wireframe de la Pestaña de Reconexión QR en Panel Web</div>
</div>
"""

DOCS = [
    ("01_Necesidades_del_Usuario_HIDROSYS", "1. ANÁLISIS DE NECESIDADES DEL USUARIO", "Estudio integral de necesidades operativas y actores del proyecto", DOC1_CONTENT),
    ("02_Historias_de_Usuario_HIDROSYS", "2. HISTORIAS DE USUARIO (PLANTILLA OFICIAL)", "Fichas oficiales institucional ISTA con estándares INVEST", DOC2_CONTENT),
    ("03_Casos_de_Uso_Cero_y_Detallados_HIDROSYS", "3. CASOS DE USO CERO Y DETALLADOS", "Fichas oficiales institucional ISTA con actores UML", DOC3_CONTENT),
    ("04_Casos_de_Uso_de_Contexto_HIDROSYS", "4. CASOS DE USO DE CONTEXTO", "Delimitación arquitectónica de fronteras y protocolos", DOC4_CONTENT),
    ("05_Casos_de_Uso_de_Escenario_HIDROSYS", "5. CASOS DE USO DE ESCENARIO", "Plantillas oficiales para escenarios y secuencias operativas", DOC5_CONTENT),
    ("06_Requisitos_Funcionales_y_No_Funcionales_HIDROSYS", "6. REQUISITOS FUNCIONALES Y NO FUNCIONALES", "Tabla institucional oficial ISTA de Requerimientos RF y RNF", DOC6_CONTENT),
    ("07_Diagramas_de_Actividades_y_Flujos_HIDROSYS", "7. DIAGRAMAS DE ACTIVIDADES Y FLUJOS", "Flujogramas BPMN de reconexión QR y agendamiento", DOC7_CONTENT),
    ("08_Problemas_Encontrados_y_Soluciones_HIDROSYS", "8. PROBLEMAS ENCONTRADOS Y SOLUCIONES", "Análisis técnico comparativo Antes/Después en Hidrosys", DOC8_CONTENT),
    ("09_Mockups_y_Prototipos_del_Sistema_HIDROSYS", "9. MOCKUPS Y PROTOTIPOS DEL SISTEMA", "Diseño visual UI/UX del panel web y asistente móvil", DOC9_CONTENT),
]

def generate_all():
    print(f"Iniciando generación con Plantillas Oficiales ISTA de {len(DOCS)} informes...")
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
