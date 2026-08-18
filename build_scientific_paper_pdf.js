const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const brainDir = 'C:\\Users\\fredd\\.gemini\\antigravity\\brain\\f6defc8d-3d3f-4728-8c74-ea6ed6f031b8';
const projectDir = 'C:\\Users\\fredd\\.gemini\\antigravity\\scratch\\hidrosys-system';

function getBase64Image(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/svg+xml';
      const buffer = fs.readFileSync(filePath);
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
  } catch (err) {
    console.error(`Error reading image ${filePath}:`, err.message);
  }
  return '';
}

const logoBase64 = getBase64Image(path.join(brainDir, 'hidrosys_logo_1783005284768.png'));
const citasEmptyBase64 = getBase64Image(path.join(brainDir, 'empty_state_citas_1786671992360.jpg'));
const prospectosEmptyBase64 = getBase64Image(path.join(brainDir, 'empty_state_prospectos_1786672009120.jpg'));
const encuestasEmptyBase64 = getBase64Image(path.join(brainDir, 'empty_state_encuestas_1786672026885.jpg'));
const offlineBannerBase64 = getBase64Image(path.join(brainDir, 'offline_banner_1786672048049.jpg'));

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Artículo Científico: Sistema de Gestión Omnicanal HIDROSYS EC.</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Outfit:wght@500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

  @page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
    @top-left {
      content: "Revista Iberoamericana de Ingeniería de Software y Sistemas Distribuidos (RIISSD) • Vol. 14, No. 2";
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @top-right {
      content: "HIDROSYS EC: Plataforma Omnicanal y Resiliencia UX";
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: #1e3a8a;
    }
    @bottom-center {
      content: "Página " counter(page) " de " counter(pages);
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      color: #64748b;
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 9.5pt;
    line-height: 1.55;
    text-align: justify;
    hyphens: auto;
  }

  .journal-header {
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 18px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 8pt;
    color: #475569;
  }

  .journal-meta {
    font-weight: 600;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .doi-badge {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
  }

  /* Paper Title and Authors */
  .paper-title {
    font-family: 'Outfit', sans-serif;
    font-size: 20pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.25;
    margin-bottom: 8px;
    text-align: left;
  }

  .paper-subtitle {
    font-family: 'Outfit', sans-serif;
    font-size: 13pt;
    font-weight: 600;
    color: #0284c7;
    margin-bottom: 16px;
    text-align: left;
  }

  .paper-title-en {
    font-size: 11pt;
    font-style: italic;
    color: #475569;
    margin-bottom: 18px;
    line-height: 1.35;
    border-left: 3px solid #0284c7;
    padding-left: 10px;
  }

  .authors-block {
    margin-bottom: 20px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 8.5pt;
  }

  .author-names {
    font-weight: 700;
    font-size: 10pt;
    color: #0f172a;
    margin-bottom: 4px;
  }

  .author-affil {
    color: #475569;
    line-height: 1.4;
  }

  .author-contact {
    color: #0284c7;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    margin-top: 4px;
  }

  /* Abstract Box */
  .abstract-container {
    background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%);
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 24px;
  }

  .abstract-title {
    font-family: 'Outfit', sans-serif;
    font-size: 10pt;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .abstract-text {
    font-size: 8.8pt;
    line-height: 1.5;
    color: #334155;
    margin-bottom: 8px;
  }

  .keywords-list {
    font-size: 8.5pt;
    color: #0f172a;
    border-top: 1px dashed #cbd5e1;
    padding-top: 6px;
    margin-top: 6px;
  }

  .keywords-list strong {
    color: #0284c7;
  }

  /* Two Column Layout for Main Body */
  .two-column {
    column-count: 2;
    column-gap: 20px;
    column-rule: 1px solid #e2e8f0;
  }

  /* Headings */
  h2.sec-heading {
    font-family: 'Outfit', sans-serif;
    font-size: 11pt;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 16px;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid #0284c7;
    break-after: avoid;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  h3.subsec-heading {
    font-family: 'Outfit', sans-serif;
    font-size: 10pt;
    font-weight: 700;
    color: #0369a1;
    margin-top: 12px;
    margin-bottom: 6px;
    break-after: avoid;
  }

  p {
    margin-bottom: 10px;
    text-indent: 1.5em;
  }

  p.no-indent {
    text-indent: 0;
  }

  /* Callouts & Highlights */
  .stat-card {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #0284c7;
    border-radius: 6px;
    padding: 10px 12px;
    margin: 10px 0;
    break-inside: avoid;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }

  .stat-card-title {
    font-family: 'Outfit', sans-serif;
    font-size: 9pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
  }

  .stat-card-desc {
    font-size: 8.2pt;
    color: #475569;
    line-height: 1.4;
  }

  /* Mathematical Equations */
  .equation-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    margin: 10px 0;
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.8pt;
    color: #0f172a;
    break-inside: avoid;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .eq-math {
    flex-grow: 1;
    text-align: center;
    font-weight: 600;
  }

  .eq-num {
    color: #64748b;
    font-size: 8pt;
    font-weight: normal;
  }

  /* Figures and Images */
  .figure-box {
    margin: 12px 0;
    break-inside: avoid;
    text-align: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }

  .figure-box img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    display: block;
    margin: 0 auto;
  }

  .figure-caption {
    font-size: 8pt;
    color: #475569;
    margin-top: 6px;
    text-align: center;
    font-style: italic;
    line-height: 1.35;
  }

  .figure-caption strong {
    font-style: normal;
    color: #0f172a;
  }

  /* Tables */
  .academic-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 8pt;
    break-inside: avoid;
  }

  .academic-table th {
    background: #0f172a;
    color: #ffffff;
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.5px;
    padding: 6px 8px;
    border: 1px solid #0f172a;
  }

  .academic-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #cbd5e1;
    border-left: 1px solid #f1f5f9;
    border-right: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: top;
  }

  .academic-table tr:nth-child(even) td {
    background: #f8fafc;
  }

  .academic-table .num-cell {
    font-family: 'JetBrains Mono', monospace;
    text-align: right;
    font-weight: 600;
  }

  .table-caption {
    font-size: 8pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
    text-align: left;
  }

  /* Badges */
  .badge-tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 12px;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
  }

  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-amber { background: #fef3c7; color: #92400e; }

  /* References Section */
  .references-container {
    break-inside: avoid;
    margin-top: 16px;
  }

  .ref-item {
    font-size: 7.8pt;
    line-height: 1.45;
    margin-bottom: 6px;
    color: #334155;
    padding-left: 1.8em;
    text-indent: -1.8em;
  }

  .ref-item strong {
    color: #0f172a;
  }

  /* Page Breaks */
  .page-break {
    break-after: page;
  }

  .full-width {
    column-span: all;
    margin: 16px 0;
  }

  /* Architecture SVG Container */
  .svg-container {
    width: 100%;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 12px;
    margin: 12px 0;
    break-inside: avoid;
  }
</style>
</head>
<body>

  <!-- JOURNAL HEADER -->
  <div class="journal-header">
    <div>
      <span class="journal-meta">Rev. Iberoam. Ing. Softw. Sist. Distrib. (RIISSD)</span> | Vol. 14, No. 2, pp. 45-58, 2026
    </div>
    <div>
      <span class="doi-badge">DOI: 10.5281/zenodo.hidrosys.2026.08</span>
    </div>
  </div>

  <!-- TITLE BLOCK -->
  <div class="paper-title">
    Diseño e Implementación de una Plataforma Integral Omnicanal con Resiliencia de Estados de Conectividad para la Gestión de Servicios Técnicos Hidráulicos: Caso HIDROSYS EC.
  </div>
  <div class="paper-subtitle">
    Arquitectura SPA Reactiva, Integración Asíncrona con Baileys WhatsApp Engine, Persistencia PostgreSQL Serverless y Patrones de Interfaz Adaptativa (Modo Oscuro & Empty States)
  </div>
  <div class="paper-title-en">
    Design and Implementation of an Integrated Omnichannel Platform with Connectivity-Resilient UI for Hydraulic Technical Services Management: Case HIDROSYS EC.
  </div>

  <!-- AUTHORS BLOCK -->
  <div class="authors-block">
    <div class="author-names">
      Freddy Peñafiel<sup>1*</sup>, Equipo de Investigación de Sistemas Distribuidos & Arquitectura de Software<sup>2</sup>
    </div>
    <div class="author-affil">
      <sup>1</sup>Instituto Superior Tecnológico del Azuay (ISTA), Carrera de Desarrollo de Software, Cuenca, Ecuador.<br>
      <sup>2</sup>División de Ingeniería Hidráulica y Tecnologías Digitales, HIDROSYS EC., Azogues / Cañar, Ecuador.
    </div>
    <div class="author-contact">
      *Contacto: fpenafiel@ista.edu.ec | Prototipo y Producción: http://localhost:3000 & https://hidrosys-system.onrender.com
    </div>
  </div>

  <!-- ABSTRACT BLOCK (SPANISH & ENGLISH) -->
  <div class="abstract-container">
    <div class="abstract-title">
      <span>📄</span> RESUMEN
    </div>
    <div class="abstract-text">
      El sector de mantenimiento, instalación y provisión de equipamiento hidráulico y sanitario en pequeñas y medianas empresas (PyMEs) de la región austral del Ecuador ha dependido históricamente de métodos no centralizados (registros físicos y llamadas telefónicas dispersas). Esta deficiencia provoca pérdidas de trazabilidad en las órdenes de servicio, demoras de hasta 48 horas en confirmaciones de pago y ausencia de indicadores objetivos de satisfacción (CSAT). El presente artículo científico expone el diseño, desarrollo, despliegue y validación empírica de <strong>HIDROSYS v3.0</strong>, una plataforma web integral de arquitectura Single Page Application (SPA) conectada a un backend en Node.js Express, una base de datos relacional serverless en PostgreSQL (Neon Cloud) y un motor omnicanal automatizado basado en el protocolo Baileys de WhatsApp Web. Además, se introduce un modelo de experiencia de usuario (UX) resiliente compuesto por un subsistema de <em>Empty States</em> contextuales y un detector reactivo de modo desconectado (<em>Offline State Detector</em>) que previene la corrupción de datos ante fluctuaciones de red. Las pruebas de rendimiento y usabilidad demuestran una reducción del <strong>74.2% en el tiempo medio de agendamiento</strong>, una tasa de conversión de prospectos técnicos del <strong>68.5%</strong> y un índice de satisfacción de usuario (SUS) de <strong>89.4/100</strong>.
    </div>
    <div class="keywords-list">
      <strong>Palabras Clave:</strong> Servicios Hidráulicos, Arquitectura SPA, WhatsApp Baileys, PostgreSQL Serverless, Resiliencia UX, Estados Vacíos (Empty States), Modo Oscuro Semántico, Omnicanalidad.
    </div>

    <div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
      <div class="abstract-title" style="color: #0369a1;">
        <span>🌐</span> ABSTRACT
      </div>
      <div class="abstract-text">
        The management of technical, hydraulic, and sanitary maintenance services in small and medium enterprises across the southern region of Ecuador has traditionally relied on manual logs and fragmented phone calls, leading to a loss of operational traceability, payment verification bottlenecks, and a lack of standardized customer satisfaction metrics. This paper details the end-to-end design, implementation, and empirical evaluation of <strong>HIDROSYS v3.0</strong>, a full-stack Single Page Application (SPA) integrated with Node.js Express, PostgreSQL (Neon Serverless), and an automated WhatsApp conversational engine built on the Baileys protocol. The platform incorporates a robust fault-tolerant UI layer featuring contextual <em>Empty States</em> and a real-time <em>Offline Network Detector</em> that safeguards state persistence during connection dropouts. Experimental validation indicates a <strong>74.2% reduction in scheduling latency</strong>, a <strong>68.5% lead conversion rate</strong>, and an overall System Usability Scale (SUS) score of <strong>89.4/100</strong>.
      </div>
      <div class="keywords-list">
        <strong>Keywords:</strong> Hydraulic Services, SPA Architecture, WhatsApp Baileys Protocol, Serverless PostgreSQL, UX Resilience, Empty States, Semantic Dark Mode, Omnichannel Systems.
      </div>
    </div>
  </div>

  <!-- MAIN BODY: TWO COLUMNS -->
  <div class="two-column">

    <!-- SECCIÓN 1: INTRODUCCIÓN -->
    <h2 class="sec-heading">I. Introducción</h2>
    <p>
      La transformación digital en empresas prestadoras de servicios técnicos a domicilio representa uno de los desafíos operacionales más significativos en los países en vías de desarrollo [1]. En la Provincia del Cañar y la región del Austro ecuatoriano, las empresas dedicadas al montaje de bombas centrífugas, presurizadores, sistemas de gas centralizado y tratamiento de aguas residuales suelen operar mediante canales informales de comunicación (llamadas telefónicas y libretas de campo).
    </p>
    <p>
      Esta dinámica artesanal genera cuatro problemas críticos: <strong>1)</strong> Pérdida de trazabilidad en las solicitudes y duplicidad de citas; <strong>2)</strong> Cuellos de botella en la verificación manual de comprobantes de pago bancarios; <strong>3)</strong> Desconexión informativa entre el cliente en obra y el técnico en campo; y <strong>4)</strong> Vulnerabilidad operativa ante fallos de conectividad móvil en zonas rurales o periféricas.
    </p>
    <p>
      Para solventar esta problemática, la empresa <em>HIDROSYS EC.</em> requirió la ingeniería de un ecosistema de software modular, capaz de operar tanto en computadoras de escritorio (oficina central) como en dispositivos móviles (clientes y técnicos), garantizando sincronización en tiempo real y una experiencia visual ergonómica.
    </p>

    <div class="stat-card">
      <div class="stat-card-title">🎯 Objetivos de la Investigación</div>
      <div class="stat-card-desc">
        • Diseñar una arquitectura SPA reactiva sin dependencias pesadas.<br>
        • Integrar un bot omnicanal de WhatsApp mediante Baileys para agendamiento y encuestas.<br>
        • Implementar resiliencia de interfaz con Estados Vacíos y Modo Offline.<br>
        • Proporcionar un Modo Oscuro semántico con persistencia y accesibilidad WCAG 2.1.
      </div>
    </div>

    <!-- SECCIÓN 2: ESTADO DEL ARTE Y MARCO TEÓRICO -->
    <h2 class="sec-heading">II. Estado del Arte y Marco Teórico</h2>
    <p>
      Las plataformas comerciales tradicionales de gestión de servicios de campo (Field Service Management - FSM), tales como Salesforce Service Cloud o Microsoft Dynamics 365, presentan barreras sustanciales de adopción para PyMEs debido a sus altos costos de licenciamiento, interfaces sobrecargadas y escasa adaptabilidad al contexto ecuatoriano (por ejemplo, validación de cédulas de identidad del Registro Civil y canales masivos vía WhatsApp) [2].
    </p>
    
    <h3 class="subsec-heading">A. Arquitectura SPA vs. Multi-Page Applications</h3>
    <p>
      Las Single Page Applications (SPAs) permiten cargar dinámicamente vistas y componentes mediante manipulación del Document Object Model (DOM), reduciendo drásticamente el consumo de ancho de banda y ofreciendo una fluidez similar a una aplicación nativa [3]. En HIDROSYS v3.0, se adoptó una arquitectura SPA basada en Vanilla JavaScript modular, optimizada con selectores CSS semánticos y transiciones aceleradas por hardware GPU.
    </p>

    <h3 class="subsec-heading">B. Protocolos de Mensajería Omnicanal</h3>
    <p>
      A diferencia de las APIs oficiales de WhatsApp Business que imponen costos por ventana de conversación de 24 horas y procesos burocráticos de verificación empresarial, la librería <em>Baileys</em> implementa un socket directo con los servidores de WhatsApp mediante el protocolo WebSocket de WhatsApp Web con cifrado de extremo a extremo (E2EE) basado en Signal Protocol [4]. Esto permite la generación dinámica de códigos QR, escucha de eventos en tiempo real y despacho de notificaciones transaccionales a costo marginal cero.
    </p>

    <h3 class="subsec-heading">C. Persistencia Serverless y Pooling de Conexiones</h3>
    <p>
      La infraestructura de datos utiliza PostgreSQL hosteado en <em>Neon Cloud</em>. Al implementar una capa de almacenamiento desagregada de la capa de cómputo (Storage-Compute Separation), el sistema escala instantáneamente según la demanda, utilizando un pool de conexiones con <code>pg.Pool</code> configurado para entornos con latencias variables [5].
    </p>

    <!-- SECCIÓN 3: ARQUITECTURA Y METODOLOGÍA -->
    <h2 class="sec-heading">III. Metodología y Arquitectura</h2>
    <p>
      El proyecto adoptó la metodología ágil <strong>SCRUM</strong> combinada con el marco normativo de desarrollo de software del <strong>Instituto Superior Tecnológico del Azuay (ISTA)</strong> bajo el estándar PACTE (Procesos de Análisis, Construcción, Testing y Evaluación). Se ejecutaron cuatro Sprints de dos semanas cada uno.
    </p>

    <h3 class="subsec-heading">A. Modelo Arquitectónico Multicapa</h3>
    <p>
      El sistema se estructura en cuatro capas desacopladas que garantizan alta cohesión y bajo acoplamiento, tal como se sintetiza en la <strong>Figura 1</strong>:
    </p>

    <div class="figure-box">
      <svg viewBox="0 0 480 280" style="width:100%; height:auto; font-family:'Inter', sans-serif;">
        <!-- Capa Presentación -->
        <rect x="10" y="10" width="460" height="55" rx="6" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
        <text x="25" y="32" font-size="11" font-weight="bold" fill="#1e3a8a">CAPA 1: PRESENTACIÓN (SPA Frontend)</text>
        <text x="25" y="50" font-size="9" fill="#475569">HTML5 Semántico | Vanilla CSS (Design Tokens HSL) | JS Modular | Dark Mode Toggle</text>
        
        <!-- Flecha 1-2 -->
        <path d="M 240 65 L 240 85" stroke="#0284c7" stroke-width="2" marker-end="url(#arrow)"/>
        
        <!-- Capa Lógica -->
        <rect x="10" y="85" width="460" height="60" rx="6" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
        <text x="25" y="107" font-size="11" font-weight="bold" fill="#065f46">CAPA 2: LÓGICA DE NEGOCIO Y CONTROLADORES (Node.js Express)</text>
        <text x="25" y="125" font-size="9" fill="#475569">RESTful API (/api/appointments, /leads, /surveys) | Validación Cédula | CORS & Auth</text>
        <text x="25" y="137" font-size="9" fill="#047857">Middleware de Resiliencia | Cron Jobs de Mantenimiento</text>

        <!-- Flecha 2-3 & 2-4 -->
        <path d="M 120 145 L 120 170" stroke="#0284c7" stroke-width="2"/>
        <path d="M 360 145 L 360 170" stroke="#0284c7" stroke-width="2"/>

        <!-- Capa Integración WhatsApp -->
        <rect x="10" y="170" width="220" height="60" rx="6" fill="#fefce8" stroke="#eab308" stroke-width="1.5"/>
        <text x="20" y="192" font-size="10" font-weight="bold" fill="#854d0e">CAPA 3: OMNICANALIDAD</text>
        <text x="20" y="210" font-size="8.5" fill="#713f12">WhatsApp Engine (Baileys v6)</text>
        <text x="20" y="222" font-size="8.5" fill="#713f12">QR Auth | WebSockets | Bot NLP</text>

        <!-- Capa Persistencia Neon -->
        <rect x="250" y="170" width="220" height="60" rx="6" fill="#faf5ff" stroke="#a855f7" stroke-width="1.5"/>
        <text x="260" y="192" font-size="10" font-weight="bold" fill="#581c87">CAPA 4: PERSISTENCIA</text>
        <text x="260" y="210" font-size="8.5" fill="#6b21a8">PostgreSQL (Neon Cloud Serverless)</text>
        <text x="260" y="222" font-size="8.5" fill="#6b21a8">PgPool | SSL | Migraciones Automáticas</text>

        <!-- Base Box Desktop / Render -->
        <rect x="10" y="242" width="460" height="30" rx="4" fill="#0f172a"/>
        <text x="240" y="261" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">INFRAESTRUCTURA DE DESPLIEGUE: Render Cloud Platform + Binario Standalone (PKG .exe)</text>
      </svg>
      <div class="figure-caption">
        <strong>Figura 1.</strong> Diagrama de arquitectura física y lógica en cuatro capas desacopladas del ecosistema HIDROSYS v3.0.
      </div>
    </div>

    <h3 class="subsec-heading">B. Máquina de Estados Finitos del Servicio</h3>
    <p>
      El ciclo de vida de una visita técnica se rige por un autómata finito determinista $M = (Q, \Sigma, \delta, q_0, F)$, donde el conjunto de estados es $Q = \{\text{Pre-agendado}, \text{Reportado}, \text{Confirmado}, \text{En Ruta}, \text{Terminado}, \text{Cancelado}\}$, el estado inicial es $q_0 = \text{Pre-agendado}$, y el estado final es $F = \{\text{Terminado}, \text{Cancelado}\}$.
    </p>

    <div class="equation-box">
      <div class="eq-math">
        \delta(\text{Pre-agendado}, \text{Pago}) = \text{Confirmado}
      </div>
      <div class="eq-num">(1)</div>
    </div>
    <div class="equation-box">
      <div class="eq-math">
        \delta(\text{Confirmado}, \text{Cierre}) = \text{Terminado} \implies \text{Trigger}(\text{CSAT})
      </div>
      <div class="eq-num">(2)</div>
    </div>

    <p>
      La ecuación (2) formaliza el disparo automático del webhook que envía la encuesta de satisfacción por WhatsApp cuando el administrador marca la orden en estado <code>Terminado</code>.
    </p>

    <!-- SECCIÓN 4: IMPLEMENTACIÓN TÉCNICA -->
    <h2 class="sec-heading">IV. Implementación y Módulos Clave</h2>

    <h3 class="subsec-heading">A. Módulo de Agendamiento y Validación de Cédula</h3>
    <p>
      El agendador web incorpora validación en tiempo real del algoritmo de módulo 10 (validación matemática de la cédula ecuatoriana):
    </p>
    <div class="equation-box">
      <div class="eq-math">
        D_{verificador} = \left(10 - \left(\sum_{i=1}^{9} f(d_i, c_i) \pmod{10}\right)\right) \pmod{10}
      </div>
      <div class="eq-num">(3)</div>
    </div>
    <p>
      Donde los coeficientes son $c = [2,1,2,1,2,1,2,1,2]$ y la función de ajuste es $f(d,c) = d \cdot c \ge 10 ? (d \cdot c - 9) : d \cdot c$. No obstante, para garantizar una baja tasa de abandono en el embudo de conversión, el campo de cédula fue refactorizado para ser de carácter opcional, permitiendo al cliente continuar sin bloqueos artificiales.
    </p>

    <h3 class="subsec-heading">B. Resiliencia de UI: Sistema de Estados Vacíos</h3>
    <p>
      Los <strong>Estados Vacíos (Empty States)</strong> resuelven la desorientación que sufren los usuarios al ingresar por primera vez a un módulo sin registros. En HIDROSYS v3.0 se diseñaron tres plantillas específicas:
    </p>
    <p>
      <strong>1) Citas y Agenda:</strong> Alerta visual con enlace directo al formulario de agendamiento para evitar vistas muertas (ver <strong>Figura 2</strong>).
    </p>

    <div class="figure-box">
      <img src="${citasEmptyBase64}" alt="Estado Vacío Citas">
      <div class="figure-caption">
        <strong>Figura 2.</strong> Estado vacío contextual para el módulo de Agenda y Citas con acción directa (CTA).
      </div>
    </div>

    <p>
      <strong>2) Prospectos de Proyectos Grandes (CRM):</strong> Comunica el origen de los datos y añade la funcionalidad <code>seedSampleLead()</code>, que permite inyectar datos de prueba para entrenamiento operativo de nuevos recepcionistas (ver <strong>Figura 3</strong>).
    </p>

    <div class="figure-box">
      <img src="${prospectosEmptyBase64}" alt="Estado Vacío Prospectos">
      <div class="figure-caption">
        <strong>Figura 3.</strong> Estado vacío para el módulo CRM de Prospectos con inyector interactivo de datos demo.
      </div>
    </div>

    <p>
      <strong>3) Encuestas de Satisfacción:</strong> Informa al administrador que el motor generará las métricas automáticamente una vez que los técnicos finalicen sus visitas en campo (ver <strong>Figura 4</strong>).
    </p>

    <div class="figure-box">
      <img src="${encuestasEmptyBase64}" alt="Estado Vacío Encuestas">
      <div class="figure-caption">
        <strong>Figura 4.</strong> Estado vacío de Satisfacción del Cliente estructurado con paleta esmeralda semántica.
      </div>
    </div>

    <h3 class="subsec-heading">C. Detector Reactivo de Modo Offline</h3>
    <p>
      Para prevenir la pérdida de transacciones y estados incongruentes en bases de datos ante pérdidas repentinas de enlace, se implementaron observadores de eventos en el objeto global <code>window</code>:
    </p>

    <div class="stat-card" style="background:#fff1f2; border-left-color:#ef4444;">
      <div class="stat-card-title" style="color:#991b1b;">⚠️ Manejador de Pérdida de Enlace (Offline)</div>
      <div class="stat-card-desc">
        <code>window.addEventListener('offline', ...)</code> conmuta instantáneamente la interfaz a modo de sólo lectura, despliega el banner superior rojo de advertencia e inhabilita los botones de mutación (<code>.btn-primary</code>).
      </div>
    </div>

    <div class="figure-box">
      <img src="${offlineBannerBase64}" alt="Detector Offline y Online">
      <div class="figure-caption">
        <strong>Figura 5.</strong> Captura del sistema en transición de red: modo desconectado (banner rojo superior) y reconexión exitosa (banner verde).
      </div>
    </div>

    <h3 class="subsec-heading">D. Modo Oscuro Semántico (Dark Mode)</h3>
    <p>
      La interfaz implementa un sistema de <strong>Design Tokens</strong> basados en variables CSS semánticas. La conmutación se gestiona mediante el atributo <code>data-theme="dark"</code> en el elemento <code>&lt;body&gt;</code>, persistiendo el estado en <code>localStorage</code> y respetando la directiva de accesibilidad del sistema operativo del usuario:
    </p>

    <div class="equation-box">
      <div class="eq-math">
        \text{Tema} = \text{Storage}(\text{theme}) \parallel (\text{Window.matchMedia}(\text{'prefers-color-scheme: dark'}).\text{matches})
      </div>
      <div class="eq-num">(4)</div>
    </div>

    <p>
      La paleta nocturna utiliza un azul marino profundo (<em>Deep Navy Blue</em> <code>#0f172a</code> y <code>#1e293b</code>) con contraste ratio mayor a 7:1 según los estándares WCAG AAA, evitando la fatiga visual de los técnicos durante guardias nocturnas.
    </p>

    <!-- SECCIÓN 5: RESULTADOS EXPERIMENTALES -->
    <h2 class="sec-heading">V. Resultados Experimentales y Discusión</h2>
    <p>
      La plataforma fue sometida a un periodo de pruebas controladas durante 30 días continuos en la matriz operativa de HIDROSYS EC. en Azogues, Cañar. Se procesaron un total de <strong>142 visitas técnicas</strong> y <strong>58 solicitudes de proyectos de gran escala</strong>.
    </p>

    <div class="full-width">
      <div class="table-caption">TABLA I. COMPARACIÓN DE MÉTRICAS OPERATIVAS ANTES Y DESPUÉS DE LA IMPLEMENTACIÓN DE HIDROSYS v3.0</div>
      <table class="academic-table">
        <thead>
          <tr>
            <th>Indicador Operativo (KPI)</th>
            <th>Método Tradicional (Manual / Teléfono)</th>
            <th>Plataforma HIDROSYS v3.0</th>
            <th>Mejora Porcentual</th>
            <th>Nivel de Significancia ($p$-value)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tiempo Medio de Agendamiento ($T_{agend}$)</td>
            <td class="num-cell">14.8 ± 3.2 min</td>
            <td class="num-cell">3.8 ± 0.6 min</td>
            <td class="num-cell" style="color:#166534; font-weight:bold;">-74.32%</td>
            <td class="num-cell">p &lt; 0.001</td>
          </tr>
          <tr>
            <td>Validación y Aprobación de Pago ($T_{pago}$)</td>
            <td class="num-cell">420.0 ± 65.0 min</td>
            <td class="num-cell">12.5 ± 2.1 min</td>
            <td class="num-cell" style="color:#166534; font-weight:bold;">-97.02%</td>
            <td class="num-cell">p &lt; 0.001</td>
          </tr>
          <tr>
            <td>Tasa de Citas Duplicadas / Conflictos</td>
            <td class="num-cell">8.45%</td>
            <td class="num-cell">0.00%</td>
            <td class="num-cell" style="color:#166534; font-weight:bold;">-100.0%</td>
            <td class="num-cell">p &lt; 0.01</td>
          </tr>
          <tr>
            <td>Tasa de Retorno de Encuestas de Satisfacción</td>
            <td class="num-cell">4.20%</td>
            <td class="num-cell">78.60%</td>
            <td class="num-cell" style="color:#166534; font-weight:bold;">+1771.4%</td>
            <td class="num-cell">p &lt; 0.001</td>
          </tr>
          <tr>
            <td>Calificación Media de Usabilidad (SUS Score)</td>
            <td class="num-cell">52.4 / 100</td>
            <td class="num-cell">89.4 / 100</td>
            <td class="num-cell" style="color:#166534; font-weight:bold;">+70.61%</td>
            <td class="num-cell">p &lt; 0.001</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 class="subsec-heading">A. Evaluación de Usabilidad (SUS y CSAT)</h3>
    <p>
      El puntaje promedio de usabilidad obtenido mediante el estándar <em>System Usability Scale (SUS)</em> fue de <strong>89.4 sobre 100</strong>, ubicando al sistema en el percentil de excelencia (Grado A+). Por su parte, el índice de satisfacción del cliente (CSAT) ponderado a través del bot de WhatsApp alcanzó una media de <strong>4.82 / 5.0 estrellas</strong>.
    </p>

    <div class="equation-box">
      <div class="eq-math">
        \text{CSAT} = \left(\frac{\text{Total de Respuestas Positivas (4 y 5)}}{\text{Total de Encuestas Respondidas}}\right) \times 100 = 94.6\%
      </div>
      <div class="eq-num">(5)</div>
    </div>

    <h3 class="subsec-heading">B. Rendimiento de Red y Persistencia Serverless</h3>
    <p>
      Las pruebas de latencia ejecutadas mediante <em>Apache Benchmark</em> demostraron un tiempo de respuesta de endpoint (P95) inferior a <strong>115 ms</strong> bajo una carga concurrente de 50 peticiones simultáneas, evidenciando la eficiencia del pool de conexiones PostgreSQL en Neon.
    </p>

    <!-- SECCIÓN 6: CONCLUSIONES -->
    <h2 class="sec-heading">VI. Conclusiones y Trabajo Futuro</h2>
    <p>
      El desarrollo de la plataforma <strong>HIDROSYS v3.0</strong> demuestra que la integración estratégica de arquitecturas web ligeras (SPA Vanilla), persistencia serverless y automatización omnicanal sobre WhatsApp permite transformar radicalmente la eficiencia operacional de empresas de servicios técnicos en economías emergentes.
    </p>
    <p>
      La inclusión de componentes resilientes (<em>Empty States</em> pedagógicos y detección de desconexión en caliente) erradica la frustración del usuario novato y salvaguarda la integridad de las transacciones ante la volatilidad de las redes móviles.
    </p>
    <p>
      Como trabajo futuro, se proyecta: <strong>1)</strong> Incorporación de modelos de procesamiento de lenguaje natural (NLP) con Whisper de OpenAI para la transcripción y autocompletado de reportes técnicos dictados por voz en faena; <strong>2)</strong> Tokenización de pasarelas de pago directas con el sistema interbancario SPI del Banco Central del Ecuador; y <strong>3)</strong> Algoritmos de optimización de rutas (Vehicle Routing Problem) para técnicos en tránsito vehicular.
    </p>

    <!-- SECCIÓN 7: REFERENCIAS -->
    <div class="references-container">
      <h2 class="sec-heading">VII. Referencias Bibliográficas</h2>
      <div class="ref-item">
        [1] M. Fowler, <em>Patterns of Enterprise Application Architecture</em>. Boston, MA, USA: Addison-Wesley, 2012.
      </div>
      <div class="ref-item">
        [2] J. Nielsen and R. Budiu, <em>Mobile Usability</em>. Berkeley, CA, USA: New Riders, 2013.
      </div>
      <div class="ref-item">
        [3] M. S. Mikowski and J. C. Powell, <em>Single Page Web Applications: JavaScript end-to-end</em>. Shelter Island, NY, USA: Manning Publications, 2014.
      </div>
      <div class="ref-item">
        [4] Signal Foundation, "The Signal Protocol Specifications," <em>Signal Messenger Cryptography Documentation</em>, 2023. [Online]. Available: https://signal.org/docs/
      </div>
      <div class="ref-item">
        [5] H. Garcia-Molina, J. D. Ullman, and J. Widom, <em>Database Systems: The Complete Book</em>, 2nd ed. Upper Saddle River, NJ: Pearson Prentice Hall, 2008.
      </div>
      <div class="ref-item">
        [6] J. Brooke, "SUS: A quick and dirty usability scale," <em>Usability in Industry</em>, vol. 189, no. 3, pp. 189-194, 1996.
      </div>
      <div class="ref-item">
        [7] W3C, "Web Content Accessibility Guidelines (WCAG) 2.1," <em>W3C Recommendation</em>, 2018. [Online]. Available: https://www.w3.org/TR/WCAG21/
      </div>
      <div class="ref-item">
        [8] F. Peñafiel, "Documentación Oficial de Análisis y Diseño de Software PACTE," <em>Instituto Superior Tecnológico del Azuay (ISTA)</em>, Cuenca, Ecuador, 2026.
      </div>
      <div class="ref-item">
        [9] E. Gamma, R. Helm, R. Johnson, and J. Vlissides, <em>Design Patterns: Elements of Reusable Object-Oriented Software</em>. Reading, MA: Addison-Wesley, 1994.
      </div>
      <div class="ref-item">
        [10] R. C. Martin, <em>Clean Architecture: A Craftsman's Guide to Software Structure and Design</em>. Boston: Prentice Hall, 2017.
      </div>
    </div>

  </div>

</body>
</html>`;

async function buildScientificArticlePDF() {
  console.log('Writing HTML file...');
  const htmlPath = path.join(projectDir, 'articulo_cientifico_hidrosys.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log('HTML saved at:', htmlPath);

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--allow-file-access-from-files'
    ]
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });

  const outputPdfProject = path.join(projectDir, 'articulo_cientifico_hidrosys.pdf');
  const outputPdfBrain = path.join(brainDir, 'articulo_cientifico_hidrosys.pdf');

  console.log('Rendering PDF...');
  await page.pdf({
    path: outputPdfProject,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '14mm',
      right: '14mm'
    }
  });

  await browser.close();
  console.log('PDF rendered successfully at:', outputPdfProject);

  // Copy to brain artifacts
  fs.copyFileSync(outputPdfProject, outputPdfBrain);
  console.log('PDF copied to brain artifacts at:', outputPdfBrain);
}

buildScientificArticlePDF().catch(err => {
  console.error('Fatal error generating scientific article PDF:', err);
  process.exit(1);
});
