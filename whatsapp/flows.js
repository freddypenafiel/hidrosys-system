// whatsapp/flows.js - Motor de Conversacion HIDROSYS v4.0
// Polls Nativos Interactivos, Barra de Progreso, UX Empresarial

const pool = require("../db/connection");

const CANTONES = {
    "1": { nombre: "Azogues",    parroquias: ["Azogues","Cojitambo","Guapan","Javier Loyola","Luis Cordero","Pindilig","Rivera","San Miguel","Taday"] },
    "2": { nombre: "Biblian",    parroquias: ["Biblian","Nazon","San Francisco de Sageo","Turupamba"] },
    "3": { nombre: "Canar",      parroquias: ["Canar","General Morales","Gualleturo","Honorato Vasquez","Ingapirca","Juncal","San Antonio"] },
    "4": { nombre: "La Troncal", parroquias: ["La Troncal","Manuel de J. Calle","Pancho Negro"] },
    "5": { nombre: "El Tambo",   parroquias: ["El Tambo"] },
    "6": { nombre: "Deleg",      parroquias: ["Deleg","Solano"] },
    "7": { nombre: "Suscal",     parroquias: ["Suscal"] }
};

const SERVICIOS = [
    "Instalacion de Medidor de Agua",
    "Revision / Reparacion de Tuberia",
    "Instalacion de Red de Gas Domiciliario",
    "Mantenimiento de Sistema Hidraulico",
    "Inspeccion Tecnica General",
    "Otro / Consulta"
];
const SERVICIOS_EMOJIS = ["💧","🔩","⛽","🔨","🔍","💬"];
const CUENTAS_BANCARIAS = "💳 *Cuentas para Transferencia:*\n1. *B. Pichincha* – Cta: 2201948332\n2. *B. Guayaquil* – Cta: 10482938\n3. *Produbanco* – Cta: 0209384729\n4. *JEP (Cooperativa)* – Cta: 551928374\n5. *B. del Pacifico* – Cta: 72938472\n6. *Coop. MEGO* – Cta: 938482932\n7. *Alianza del Valle* – Cta: 384729221\n_Titular: HIDROSYS EC. · RUC: 1793000000001_";

const sessions = new Map();
function getSession(phone) {
    if (!sessions.has(phone)) sessions.set(phone, { step: "idle", data: {} });
    return sessions.get(phone);
}
function setSession(phone, step, data) {
    const cur = getSession(phone);
    sessions.set(phone, { step, data: Object.assign({}, cur.data, data || {}) });
}
function clearSession(phone) { sessions.set(phone, { step: "idle", data: {} }); }

function norm(str) {
    return String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function progressBar(step, total) {
    const filled = Math.round((step / total) * 6);
    const bar = "▓".repeat(filled) + "░".repeat(6 - filled);
    return bar + " " + Math.round((step / total) * 100) + "%";
}

const STEP_LABELS = {
    book_name:    [1, 6, "Tu nombre completo"],
    book_phone:   [2, 6, "Tu numero de celular"],
    book_address: [3, 6, "Direccion del inmueble"],
    book_canton:  [4, 6, "Canton de la Provincia del Canar"],
    book_parish:  [4, 6, "Parroquia"],
    book_service: [5, 6, "Tipo de servicio"],
    book_date:    [6, 6, "Fecha de visita"],
    book_time:    [6, 6, "Horario preferido"],
    book_confirm: [6, 6, "Confirmacion de cita"]
};

function stepHeader(k) {
    const info = STEP_LABELS[k];
    if (!info) return "";
    return "Paso " + info[0] + " de " + info[1] + " " + progressBar(info[0], info[1]) + "\n_" + info[2] + "_\n\n";
}

function menuPoll() {
    return { type: "poll", question: "💧 HIDROSYS EC. — ¿En que te ayudamos hoy?", options: ["📅 Agendar Visita Tecnica","💳 Reportar Comprobante de Pago","🔍 Consultar Estado de mi Cita","📦 Ver Catalogo y Precios"] };
}

function getTomorrowDateStr() {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
}

// ============================================================
// PROCESADOR PRINCIPAL DE MENSAJES
// ============================================================
async function processMessage(phone, text, senderJid) {
    const msg  = text.trim();
    const sess = getSession(phone);
    const step = sess.step;
    const msgN = norm(msg);

    if (senderJid && !sess.data.senderJid) setSession(phone, step, { senderJid });

    // Comandos globales
    if (["menu","hola","hi","inicio","0","cancelar","cancel","empezar"].includes(msgN)) {
        clearSession(phone);
        setSession(phone, "main_menu", { senderJid });
        return menuPoll();
    }

    // Navegacion inversa
    const esAtras = ["atras","volver","corregir","cambiar","anterior"].includes(msgN);
    if (esAtras && ["book_phone","book_address","book_canton","book_parish","book_service","book_date","book_time","book_confirm"].includes(step)) {
        const back = { book_phone:"book_name", book_address:"book_phone", book_canton:"book_address", book_parish:"book_canton", book_service:"book_canton", book_date:"book_service", book_time:"book_date", book_confirm:"book_time" };
        const prev = back[step];
        setSession(phone, prev, {});
        if (prev === "book_name") return stepHeader("book_name") + "Escribe de nuevo tu *nombre completo*:";
        if (prev === "book_phone") return stepHeader("book_phone") + "📱 Escribe tu *celular* (10 digitos):";
        if (prev === "book_address") return stepHeader("book_address") + "🏠 Escribe la *direccion* del inmueble:";
        if (prev === "book_canton") return { type:"poll", question:"📍 Paso 4 de 6 — ¿En que canton de la Provincia del Canar estas?", options:["Azogues","Biblian","Canar","La Troncal","El Tambo","Deleg","Suscal"] };
        return menuPoll();
    }

    // Confirmacion de disponibilidad (SI/NO tras confirmacion de admin)
    if (step === "awaiting_availability_confirm") {
        if (["si","s","1","confirmo","confirmar"].includes(msgN) || msgN.includes("si, estare")) {
            try {
                let aptId = sess.data.aptId;
                if (!aptId) {
                    const res = await pool.query("SELECT id FROM appointments WHERE client_phone LIKE $1 AND status = 'Confirmado' ORDER BY id DESC LIMIT 1", ["%" + phone.slice(-9) + "%"]);
                    if (res.rows.length) aptId = res.rows[0].id;
                }
                if (aptId) {
                    await pool.query("UPDATE appointments SET status = 'Conf. Cliente' WHERE id = $1", [aptId]);
                    clearSession(phone);
                    return "✅ *¡Perfecto! Disponibilidad confirmada.*\n\n📋 Tu cita *#" + aptId + "* queda registrada.\n👷 Nuestro tecnico se comunicara contigo antes de la visita.\n\n¡Gracias por confiar en *HIDROSYS EC.*!\n_Escribe *menu* si necesitas algo mas._";
                }
            } catch (err) { console.error("[WA] Error Conf. Cliente:", err.message); }
        }
        if (["no","n","2"].includes(msgN) || msgN.includes("necesito reagendar")) {
            clearSession(phone);
            return "⚠️ Entendido. Escribe *menu* para agendar una nueva fecha si lo necesitas.";
        }
        return { type:"poll", question:"❓ Confirma tu disponibilidad para la visita tecnica:", options:["✅ SI, estare disponible","❌ NO, necesito reagendar"] };
    }

    // Menu principal
    if (step === "idle" || step === "main_menu") {
        if (msg==="1"||msgN.includes("agendar")||msgN.includes("visita")) { setSession(phone,"book_name",{senderJid}); return stepHeader("book_name")+"Por favor, escribe tu *nombre completo*:"; }
        if (msg==="2"||msgN.includes("pago")||msgN.includes("comprobante")) { setSession(phone,"pay_phone",{senderJid}); return "💳 *Reportar Comprobante de Pago*\n\nEscribe el *numero de telefono* con el que registraste tu cita (ej. 0987654321):"; }
        if (msg==="3"||msgN.includes("consultar")||msgN.includes("estado")) { setSession(phone,"status_phone",{senderJid}); return "🔍 *Consultar Estado de Cita*\n\nEscribe el *numero de telefono* con el que te registraste:"; }
        if (msg==="4"||msgN.includes("catalogo")||msgN.includes("precio")) { clearSession(phone); return "📦 *Catalogo de Servicios HIDROSYS:*\n\n💧 Instalacion medidor agua: $15.00\n🔩 Reparacion de tuberia: $15.00\n⛽ Red de gas domiciliario: $15.00\n🔨 Mant. sistema hidraulico: $15.00\n🔍 Inspeccion tecnica: $15.00\n\n_Precio incluye visita tecnica. Materiales cotizados en sitio._\n\nEscribe *menu* para volver."; }
        if (step === "idle") {
            clearSession(phone); setSession(phone,"main_menu",{senderJid});
            return "👋 *¡Bienvenido/a a HIDROSYS EC.!*\n_Especialistas en Sistemas de Agua y Gas · Provincia del Canar_\n\nSelecciona una opcion:";
        }
        return menuPoll();
    }

    // AGENDAMIENTO
    if (step === "book_name") {
        if (msg.length < 3) return "⚠️ Por favor escribe tu nombre completo (minimo 3 letras).";
        setSession(phone,"book_phone",{name:msg});
        return stepHeader("book_phone")+"📱 Escribe tu numero de *celular* (10 digitos, ej. 0987654321):";
    }

    if (step === "book_phone") {
        if (!/^0[0-9]{9}$/.test(msg)) return "⚠️ Numero invalido. Debe tener 10 digitos y empezar con 0 (ej: 0987654321).";
        setSession(phone,"book_address",{clientPhone:msg});
        return stepHeader("book_address")+"🏠 Escribe la *direccion* del inmueble:\n_(ej: Barrio El Portete, calle Principal y Bolivar, casa azul)_";
    }

    if (step === "book_address") {
        if (msg.length < 5) return "⚠️ Direccion muy corta. Escribe mas detalles.";
        setSession(phone,"book_canton",{address:msg});
        return { type:"poll", question:"📍 Paso 4 de 6 — ¿En que canton de la Provincia del Canar estas?", options:["Azogues","Biblian","Canar","La Troncal","El Tambo","Deleg","Suscal"] };
    }

    if (step === "book_canton") {
        let cantonData = CANTONES[msg];
        if (!cantonData) {
            const mn = norm(msg);
            const found = Object.values(CANTONES).find(c => norm(c.nombre) === mn || mn.includes(norm(c.nombre)));
            cantonData = found;
        }
        if (!cantonData) return "❌ Canton no reconocido. Escribe el nombre del canton o *menu* para reiniciar.";
        setSession(phone,"book_parish",{canton:cantonData.nombre,parroquias:cantonData.parroquias});
        if (cantonData.parroquias.length === 1) {
            setSession(phone,"book_service",{parish:cantonData.parroquias[0],zone:cantonData.nombre+" - "+cantonData.parroquias[0]});
            return { type:"poll", question:"🔧 Paso 5 de 6 — ¿Que tipo de servicio necesitas?", options:SERVICIOS.map((s,i)=>SERVICIOS_EMOJIS[i]+" "+s) };
        }
        return { type:"poll", question:"🏘️ ¿En que parroquia de "+cantonData.nombre+"?", options:cantonData.parroquias };
    }

    if (step === "book_parish") {
        const parroquias = sess.data.parroquias || [];
        let parish = null;
        const idx = parseInt(msg)-1;
        if (!isNaN(idx)&&idx>=0&&idx<parroquias.length) { parish = parroquias[idx]; }
        else { const mn=norm(msg); parish=parroquias.find(p=>norm(p)===mn||norm(p).includes(mn)); }
        if (!parish) return "❌ Opcion no valida. Escribe el nombre de la parroquia.";
        setSession(phone,"book_service",{parish,zone:sess.data.canton+" - "+parish});
        return { type:"poll", question:"🔧 Paso 5 de 6 — ¿Que tipo de servicio necesitas?", options:SERVICIOS.map((s,i)=>SERVICIOS_EMOJIS[i]+" "+s) };
    }

    if (step === "book_service") {
        let service = null;
        const idx = parseInt(msg)-1;
        if (!isNaN(idx)&&idx>=0&&idx<SERVICIOS.length) { service=SERVICIOS[idx]; }
        else { const mn=norm(msg); service=SERVICIOS.find(s=>mn.includes(norm(s))||norm(s).includes(mn.replace(/^[^\w]+/,""))); }
        if (!service) return "❌ Servicio no reconocido. Elige una opcion del poll.";

        const dias=["Dom","Lun","Mar","Mie","Jue","Vie","Sab"];
        const meses=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        const optionsDate=[]; const today=new Date(); let count=0,offset=1;
        while(count<5&&offset<=14){ const d=new Date(today); d.setDate(today.getDate()+offset); if(d.getDay()!==0){const iso=d.toISOString().split("T")[0];const str=dias[d.getDay()]+" "+d.getDate()+" "+meses[d.getMonth()];optionsDate.push({iso,str});count++;} offset++; }

        setSession(phone,"book_date",{service,optionsDate});
        return { type:"poll", question:"📅 Paso 6 de 6 — ¿Cuando prefieres que te visitemos?", options:optionsDate.map(o=>o.str) };
    }

    if (step === "book_date") {
        const optionsDate = sess.data.optionsDate||[];
        let fechaSeleccionada = null;
        const idx=parseInt(msg)-1;
        if(!isNaN(idx)&&idx>=0&&idx<optionsDate.length){ fechaSeleccionada=optionsDate[idx].iso; }
        else { const mn=norm(msg); const match=optionsDate.find(o=>norm(o.str)===mn||mn.includes(norm(o.str).split(" ")[1])); if(match){fechaSeleccionada=match.iso;}else if(/^\d{4}-\d{2}-\d{2}$/.test(msg)){const f=new Date(msg);const h=new Date();h.setHours(0,0,0,0);if(f>h)fechaSeleccionada=msg;} }
        if (!fechaSeleccionada) return "❌ Fecha no reconocida. Elige una opcion del poll o escribe en formato AAAA-MM-DD.";
        setSession(phone,"book_time",{date:fechaSeleccionada});
        return { type:"poll", question:"⏰ ¿En que horario prefieres la visita el "+fechaSeleccionada+"?", options:["🌅 Manana (08:00 – 12:00)","☀️ Tarde (13:00 – 17:00)","🌆 Tarde-noche (17:00 – 19:00)"] };
    }

    if (step === "book_time") {
        let horaFinal = null;
        if({"1":"09:00","2":"14:00","3":"17:00"}[msg]) horaFinal={"1":"09:00","2":"14:00","3":"17:00"}[msg];
        else if(/^\d{2}:\d{2}$/.test(msg)) horaFinal=msg;
        else { const mn=norm(msg); if(mn.includes("manana")||mn.includes("08")||mn.includes("09")) horaFinal="09:00"; else if((mn.includes("tarde")&&!mn.includes("noche"))||(mn.includes("13")||mn.includes("14"))) horaFinal="14:00"; else if(mn.includes("noche")||mn.includes("17")||mn.includes("tarde-noche")) horaFinal="17:00"; else if(mn.includes("tarde")) horaFinal="14:00"; }
        if (!horaFinal) return "❌ Horario no reconocido. Elige del poll o escribe la hora (ej: 10:00).";

        setSession(phone,"book_confirm",{time:horaFinal});
        const d=getSession(phone).data;
        const dobj=new Date(d.date+"T12:00:00");
        const diasL=["Dom","Lun","Mar","Mie","Jue","Vie","Sab"];
        const mesesL=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        const fechaLeg=diasL[dobj.getDay()]+" "+dobj.getDate()+" de "+mesesL[dobj.getMonth()];

        const resumen="✅ *Resumen de tu Solicitud de Visita Tecnica*\n\n──────────────────────\n👤 *Cliente:* "+d.name+"\n📱 *Celular:* "+d.clientPhone+"\n🏠 *Direccion:* "+d.address+"\n📍 *Zona:* "+(d.zone||d.canton)+"\n🔧 *Servicio:* "+d.service+"\n📅 *Fecha:* "+fechaLeg+"\n⏰ *Hora:* "+horaFinal+"\n💰 *Valor Visita:* $15.00 USD\n──────────────────────\n\n_¿Confirmas esta informacion?_";
        return [resumen, { type:"poll", question:"¿Confirmas para registrar tu cita?", options:["✅ SI, confirmar mi cita","✍️ No, quiero corregir algo","❌ Cancelar"] }];
    }

    if (step === "book_confirm") {
        const mn=norm(msg);
        if(["2","no","corregir"].includes(mn)||mn.includes("corregir")||mn.includes("quiero corregir")){ setSession(phone,"book_name",{}); return stepHeader("book_name")+"De acuerdo. Escribe de nuevo tu *nombre completo*:"; }
        if(["3","cancelar"].includes(mn)||mn.includes("cancelar")){ clearSession(phone); return "↩️ Agendamiento cancelado. Escribe *menu* cuando quieras volver."; }
        if(!["1","si","s","confirmar","confirmo","ok"].includes(mn)&&!mn.includes("si, confirmar")){ return { type:"poll", question:"¿Confirmas tu cita?", options:["✅ SI, confirmar mi cita","✍️ No, quiero corregir algo","❌ Cancelar"] }; }

        try {
            const d=getSession(phone).data;
            const fullJid=d.senderJid||phone+"@s.whatsapp.net";
            const result=await pool.query("INSERT INTO appointments (client_name,client_phone,address,zone,service_type,apt_date,apt_time,payment_amount,channel,status,wa_sender) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",[d.name,d.clientPhone,d.address,d.zone||d.canton,d.service,d.date,d.time,15.00,"WhatsApp","Pre-agendado",fullJid]);
            await pool.query("INSERT INTO clients (name,phone,address,zone) VALUES ($1,$2,$3,$4) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name",[d.name,d.clientPhone,d.address,d.zone||d.canton]);
            const aptId=result.rows[0].id;
            clearSession(phone);
            return "🎉 *¡Cita registrada exitosamente en HIDROSYS EC.!*\n\n📋 *ID de tu cita: #"+aptId+"*\n\n⚠️ *SIGUIENTE PASO:*\nRealiza una transferencia de *$15.00* a:\n\n"+CUENTAS_BANCARIAS+"\n\n📲 Una vez transferido, escribe *menu* y selecciona *Reportar Comprobante de Pago*.\n\n_¡Gracias por elegir HIDROSYS EC.! 💧_";
        } catch(err) {
            console.error("[WA] Error guardando cita:",err.message);
            return "❌ Error al registrar tu cita. Intenta de nuevo o llamanos directamente.";
        }
    }

    // FLUJO 2: REPORTAR PAGO
    if (step === "pay_phone") {
        const numL=msg.replace(/\D/g,"").slice(-9);
        try {
            const apts=await pool.query("SELECT id,service_type,apt_date,status FROM appointments WHERE REGEXP_REPLACE(client_phone,'\\D','','g') LIKE '%'||$1 AND status='Pre-agendado' AND (receipt_no IS NULL OR receipt_no='null' OR receipt_no='') ORDER BY created_at DESC LIMIT 5",[numL]);
            if(!apts.rows.length) return "❌ No encontre citas pendientes de pago para ese numero.\n\nVerifica e intenta de nuevo, o escribe *menu* para volver.";
            const lista=apts.rows.map((a,i)=>(i+1)+". #"+a.id+" – "+a.service_type+" ("+(a.apt_date?.toISOString().split("T")[0])+")").join("\n");
            setSession(phone,"pay_select_apt",{lookupPhone:numL,aptRows:apts.rows});
            return "📋 *Citas pendientes de pago:*\n\n"+lista+"\n\nEscribe el *numero* de la cita que ya pagaste:";
        } catch(err) { return "❌ Error al buscar citas. Intenta de nuevo."; }
    }

    if (step === "pay_select_apt") {
        const idx=parseInt(msg)-1; const rows=sess.data.aptRows||[];
        if(isNaN(idx)||idx<0||idx>=rows.length) return "❌ Numero invalido. Escribe entre 1 y "+rows.length+".";
        setSession(phone,"pay_bank",{selectedAptId:rows[idx].id});
        return { type:"poll", question:"🏦 ¿En que banco realizaste la transferencia?", options:["Banco Pichincha","Banco Guayaquil","Produbanco","JEP","Banco del Pacifico","Coop. MEGO","Alianza del Valle","Banco Bolivariano"] };
    }

    if (step === "pay_bank") {
        const bancos=["Banco Pichincha","Banco Guayaquil","Produbanco","JEP","Banco del Pacifico","Coop. MEGO","Alianza del Valle","Banco Bolivariano"];
        let banco=null; const idx=parseInt(msg)-1;
        if(!isNaN(idx)&&idx>=0&&idx<bancos.length){banco=bancos[idx];}
        else{const mn=norm(msg);banco=bancos.find(b=>norm(b)===mn||mn.includes(norm(b))||norm(b).includes(mn));}
        if(!banco) return "❌ Banco no reconocido. Elige una opcion del poll.";
        setSession(phone,"pay_receipt",{bank:banco});
        return "🧾 Escribe el *numero de comprobante* de la transferencia\n_(si no tienes, escribe: sin numero)_:";
    }

    if (step === "pay_receipt") {
        try {
            const aptId=sess.data.selectedAptId; const fullJid=sess.data.senderJid||null;
            await pool.query("UPDATE appointments SET bank=$1,receipt_no=$2,status='Reportado',payment_status='Pendiente de Validacion',wa_sender=COALESCE(wa_sender,$4) WHERE id=$3",[sess.data.bank,msg,aptId,fullJid]);
            clearSession(phone);
            return "✅ *¡Pago reportado correctamente!*\n\n📋 Cita: *#"+aptId+"*\n🏦 Banco: *"+sess.data.bank+"*\n🧾 Comprobante: *"+msg+"*\n\nUn administrador verificara tu pago en breve y recibiras confirmacion en este chat.\n\n_Escribe *menu* para volver al inicio._";
        } catch(err) { return "❌ Error al registrar el pago. Intenta de nuevo."; }
    }

    // FLUJO 3: CONSULTAR ESTADO
    if (step === "status_phone") {
        const numL=msg.replace(/\s|-/g,"");
        try {
            const apts=await pool.query("SELECT a.id,a.service_type,a.apt_date,a.status,a.payment_status,t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.client_phone=$1 ORDER BY a.created_at DESC LIMIT 3",[numL]);
            if(!apts.rows.length){clearSession(phone);return "❌ No encontre citas para ese numero.\n\n_Escribe *menu* para volver al inicio._";}
            const info=apts.rows.map(a=>{const fecha=a.apt_date?.toISOString().split("T")[0]||"N/A";const tech=a.tech_name?"\n👷 Tecnico: "+a.tech_name:"";return "📋 *Cita #"+a.id+"*\n🔧 "+a.service_type+"\n📅 Fecha: "+fecha+"\n🔵 Estado: *"+a.status+"*\n💳 Pago: "+(a.payment_status||"Pendiente")+tech;}).join("\n\n──────────────\n\n");
            clearSession(phone);
            return "🔍 *Estado de tus citas:*\n\n"+info+"\n\n_Escribe *menu* para volver al inicio._";
        } catch(err) { return "❌ Error al consultar. Intenta de nuevo."; }
    }

    // CSAT (respuesta de texto 1-5)
    if (step === "awaiting_csat") {
        const rating=parseInt(msg);
        if(rating>=1&&rating<=5) return await saveCsatRating(phone,sess.data,rating,msg);
        return { type:"poll", question:"⭐ ¿Como calificas el servicio de hoy?", options:["😍 Excelente (5/5)","😊 Bueno (4/5)","😐 Regular (3/5)","🙁 Malo (2/5)","😡 Pesimo (1/5)"] };
    }

    // Agendamiento Express NLP
    const expressData=parseExpressBookingText(msg);
    if(expressData&&(step==="idle"||step==="main_menu"||step.startsWith("book_"))){
        setSession(phone,"express_confirm",{name:expressData.name||sess.data.name||"Cliente",clientPhone:expressData.phone||phone,service:expressData.service||"Inspeccion Tecnica General",address:expressData.address||"Domicilio del Cliente",canton:expressData.canton||"Azogues",parish:expressData.parish||expressData.canton||"Azogues",zone:(expressData.canton||"Azogues")+" - "+(expressData.parish||expressData.canton||"Azogues"),date:expressData.date||getTomorrowDateStr(),time:expressData.time||"10:00",senderJid:senderJid||sess.data.senderJid});
        const s=getSession(phone).data;
        return "📋 *¡Datos detectados automaticamente!* ⚡\n\nHemos preparado tu orden:\n\n👤 *Cliente:* "+s.name+"\n🔧 *Servicio:* "+s.service+"\n📍 *Ubicacion:* "+s.address+", "+s.canton+"\n📅 *Fecha:* "+s.date+"\n⏰ *Hora:* "+s.time+"\n💰 *Valor:* $15.00\n\n_¿Confirmas para registrar la cita?_";
    }

    if (step === "express_confirm") {
        const mn=norm(msg);
        if(["1","si","s","confirmar","confirmo","ok"].includes(mn)){
            const s=sess.data;
            try {
                await pool.query("INSERT INTO clients (name,phone,address,zone) VALUES ($1,$2,$3,$4) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name",[s.name,s.clientPhone,s.address,s.zone]);
                const result=await pool.query("INSERT INTO appointments (client_name,client_phone,address,zone,service_type,apt_date,apt_time,status,payment_amount,payment_status,channel,notes,wa_sender) VALUES ($1,$2,$3,$4,$5,$6,$7,'Agendado',$8,'Pendiente','WhatsApp','Agendamiento Express WhatsApp',$9) RETURNING id",[s.name,s.clientPhone,s.address,s.zone,s.service,s.date,s.time,15.00,s.senderJid||null]);
                const aptId=result.rows[0].id; clearSession(phone);
                return "🎉 *¡Tu cita #"+aptId+" fue registrada con exito!*\n\n🛠️ Servicio: *"+s.service+"*\n📅 Fecha: *"+s.date+"* a las *"+s.time+"*\n📍 Direccion: *"+s.address+"* ("+s.canton+")\n💵 Total: *$15.00*\n\n"+CUENTAS_BANCARIAS+"\n\n👉 _Envia el numero de transaccion con la opcion 2 del menu._";
            } catch(err) { console.error("[WA] Error express booking:",err.message); return "❌ Inconveniente al guardar la cita. Escribe *menu* e intenta de nuevo."; }
        } else { clearSession(phone); return menuPoll(); }
    }

    // Fallback
    clearSession(phone); setSession(phone,"main_menu",{senderJid});
    return menuPoll();
}

// ============================================================
// PROCESADOR DE VOTOS DE POLL
// ============================================================
async function processPollVote(phone, selectedOption, senderJid) {
    const sess = getSession(phone);
    const step = sess.step;
    const opt  = String(selectedOption).trim();
    const optN = norm(opt);

    if (senderJid && !sess.data.senderJid) setSession(phone, step, { senderJid });

    // Menu principal
    if (step === "idle" || step === "main_menu") {
        if(optN.includes("agendar")||optN.includes("visita")){ setSession(phone,"book_name",{senderJid}); return stepHeader("book_name")+"Por favor, escribe tu *nombre completo*:"; }
        if(optN.includes("pago")||optN.includes("comprobante")){ setSession(phone,"pay_phone",{senderJid}); return "💳 *Reportar Comprobante de Pago*\n\nEscribe el *numero de telefono* con el que registraste tu cita:"; }
        if(optN.includes("consultar")||optN.includes("estado")){ setSession(phone,"status_phone",{senderJid}); return "🔍 *Consultar Estado de Cita*\n\nEscribe el *numero de telefono* con el que te registraste:"; }
        if(optN.includes("catalogo")||optN.includes("precio")){ clearSession(phone); return "📦 *Catalogo de Servicios HIDROSYS:*\n\n💧 Instalacion medidor: $15.00\n🔩 Reparacion tuberia: $15.00\n⛽ Red de gas: $15.00\n🔨 Mantenimiento hidraulico: $15.00\n🔍 Inspeccion tecnica: $15.00\n\nEscribe *menu* para volver."; }
    }

    // Disponibilidad SI/NO
    if (step === "awaiting_availability_confirm") {
        return await processMessage(phone, opt, senderJid);
    }

    // Pasos de agendamiento que usan poll — redirigir a processMessage con el texto de la opcion
    if (["book_canton","book_parish","book_service","book_date","book_time","book_confirm","pay_bank"].includes(step)) {
        return await processMessage(phone, opt, senderJid);
    }

    // CSAT
    if (step === "awaiting_csat") {
        let rating=0;
        if(optN.includes("excelente")||optN.includes("5/5")) rating=5;
        else if(optN.includes("bueno")||optN.includes("4/5")) rating=4;
        else if(optN.includes("regular")||optN.includes("3/5")) rating=3;
        else if(optN.includes("malo")||optN.includes("2/5")) rating=2;
        else if(optN.includes("pesimo")||optN.includes("1/5")) rating=1;
        if(rating>=1) return await saveCsatRating(phone,sess.data,rating,opt);
    }

    // Fallback
    return await processMessage(phone, opt, senderJid);
}

// ============================================================
// GUARDAR CALIFICACION CSAT
// ============================================================
async function saveCsatRating(phone, sessData, rating, rawOption) {
    try {
        const aptId=sessData.aptId;
        if(aptId) await pool.query("INSERT INTO surveys (appointment_id,rating,comment) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",[aptId,rating,rawOption]);
        const emojis={5:"😍",4:"😊",3:"😐",2:"🙁",1:"😡"};
        const labels={5:"¡Excelente!",4:"Bueno",3:"Regular",2:"Malo",1:"Pesimo"};
        clearSession(phone);
        return "⭐ *¡Gracias por tu calificacion!*\n\n"+emojis[rating]+" *"+labels[rating]+"* ("+rating+"/5)\n\n_Tu opinion nos ayuda a mejorar. ¡Hasta la proxima!_ 💧\n\n_Escribe *menu* si necesitas algo mas._";
    } catch(err) { clearSession(phone); return "⭐ ¡Gracias por tu calificacion! Tu opinion es muy valiosa. 💧"; }
}

// ============================================================
// EXPRESS NLP
// ============================================================
function parseExpressBookingText(text) {
    if(!text||text.length<15) return null;
    const lower=norm(text);
    const hasIntent=lower.includes("agendar")||lower.includes("visita")||lower.includes("mantenimiento")||lower.includes("reparar")||lower.includes("fuga")||lower.includes("bomba")||lower.includes("instal")||lower.includes("tuberia")||lower.includes("nombre:");
    if(!hasIntent) return null;
    let name="",address="",canton="Azogues",service="Inspeccion Tecnica General",date=getTomorrowDateStr(),time="10:00";
    const phoneMatch=text.match(/09\d{8}/);
    text.split("\n").forEach(l=>{const parts=l.split(":");if(parts.length>=2){const k=norm(parts[0]);const v=parts.slice(1).join(":").trim();if(k.includes("nombre")||k.includes("cliente"))name=v;if(k.includes("direc")||k.includes("calle")||k.includes("lugar"))address=v;if(k.includes("canton")||k.includes("ciudad"))canton=v;if(k.includes("servicio")||k.includes("trabajo"))service=v;if(k.includes("fecha")||k.includes("dia"))date=v;if(k.includes("hora"))time=v;}});
    Object.values(CANTONES).forEach(c=>{if(lower.includes(norm(c.nombre)))canton=c.nombre;});
    if(lower.includes("gas"))service="Instalacion de Red de Gas Domiciliario";
    else if(lower.includes("bomba")||lower.includes("hidro"))service="Mantenimiento de Sistema Hidraulico";
    else if(lower.includes("medidor"))service="Instalacion de Medidor de Agua";
    else if(lower.includes("tuberia")||lower.includes("fuga")||lower.includes("goteo"))service="Revision / Reparacion de Tuberia";
    if(!name&&lower.includes("soy ")){const a=text.substring(lower.indexOf("soy ")+4).split(/[,.\n]/)[0].trim();if(a.length>2)name=a;}
    if(!address&&(lower.includes("en ")||lower.includes("calle "))){const a=text.substring(lower.indexOf("en ")+3).split(/[,.\n]/)[0].trim();if(a.length>3)address=a;}
    if(name||address||phoneMatch) return{name:name||"Cliente Particular",phone:phoneMatch?phoneMatch[0]:null,address:address||"Direccion por confirmar",canton:canton||"Azogues",parish:canton||"Azogues",service,date,time};
    return null;
}

// ============================================================
// MENSAJES DE SISTEMA (buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage)
// ============================================================
async function buildConfirmationMessage(aptId) {
    try {
        const result=await pool.query("SELECT a.*,t.name as tech_name,t.phone as tech_phone FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.id=$1",[aptId]);
        if(!result.rows.length) return null;
        const a=result.rows[0]; const fecha=a.apt_date?.toISOString().split("T")[0]||"N/A";
        let targetJid=a.wa_sender||"",clientPhoneJid="";
        if(a.client_phone){const digits=String(a.client_phone).replace(/\D/g,"");const pn=digits.length<=10?"593"+digits.replace(/^0/,""):digits;clientPhoneJid=pn+"@s.whatsapp.net";}
        if(!targetJid)targetJid=clientPhoneJid;
        const phoneKey=targetJid.split("@")[0].replace(/\D/g,"")||clientPhoneJid.split("@")[0].replace(/\D/g,"");
        setSession(phoneKey,"awaiting_availability_confirm",{aptId:a.id});
        return{phone:targetJid,clientPhoneJid:clientPhoneJid!==targetJid?clientPhoneJid:null,message:"✅ *HIDROSYS EC. — ¡Cita Confirmada!*\n\n🎉 Tu pago fue verificado y aprobado exitosamente.\n\n📋 *Cita ID:* #"+a.id+"\n🔧 *Servicio:* "+a.service_type+"\n📅 *Fecha:* "+fecha+"\n⏰ *Hora:* "+String(a.apt_time).slice(0,5)+"\n📍 *Zona:* "+a.address+" ("+a.zone+")\n👷 *Tecnico:* "+(a.tech_name||"Tecnico Especializado HIDROSYS")+"\n\n¿Confirmas que estaras disponible en este horario?\nResponde *SI* o *NO*."};
    } catch(err){console.error("[WA] Error buildConfirmationMessage:",err.message);return null;}
}

async function buildReminderMessage(aptId) {
    try {
        const result=await pool.query("SELECT a.*,t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.id=$1",[aptId]);
        if(!result.rows.length)return null;
        const a=result.rows[0];const fecha=a.apt_date?.toISOString().split("T")[0]||"Hoy";
        let targetJid=a.wa_sender||"";
        if(!targetJid&&a.client_phone){const digits=String(a.client_phone).replace(/\D/g,"");targetJid=(digits.length<=10?"593"+digits.replace(/^0/,""):digits)+"@s.whatsapp.net";}
        return{phone:targetJid,message:"⏰ *HIDROSYS EC. - Recordatorio Automatico de Visita*\n\nEstimado/a *"+a.client_name+"*, le recordamos su visita tecnica:\n\n🛠️ *Servicio:* "+a.service_type+"\n📅 *Fecha:* "+fecha+"\n⏰ *Hora:* "+String(a.apt_time||"").slice(0,5)+"\n📍 *Direccion:* "+a.address+" ("+a.zone+")\n👷 *Tecnico:* "+(a.tech_name||"Personal Tecnico Asignado")+"\n\n_Por favor asegurese de encontrarse en el inmueble. ¡Muchas gracias!_"};
    } catch(err){console.error("[WA] Error buildReminderMessage:",err.message);return null;}
}

async function buildServiceCompletedMessage(aptId) {
    try {
        const result=await pool.query("SELECT a.*,t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.id=$1",[aptId]);
        if(!result.rows.length)return null;
        const a=result.rows[0];
        let targetJid=a.wa_sender||"";
        if(!targetJid&&a.client_phone){const digits=String(a.client_phone).replace(/\D/g,"");targetJid=(digits.length<=10?"593"+digits.replace(/^0/,""):digits)+"@s.whatsapp.net";}
        const phoneKey=targetJid.split("@")[0].replace(/\D/g,"");
        setSession(phoneKey,"awaiting_csat",{aptId:a.id});
        return{phone:targetJid,message:"🏁 *HIDROSYS EC. — Servicio Finalizado*\n\nEstimado/a *"+a.client_name+"*, el servicio de *"+a.service_type+"* ha concluido exitosamente.\n\n_¡Gracias por elegir HIDROSYS EC.! Nos importa tu opinion:_",pollQuestion:"⭐ ¿Como calificas la atencion de hoy?",pollOptions:["😍 Excelente (5/5)","😊 Bueno (4/5)","😐 Regular (3/5)","🙁 Malo (2/5)","😡 Pesimo (1/5)"]};
    } catch(err){console.error("[WA] Error buildServiceCompletedMessage:",err.message);return null;}
}

// ============================================================
// AUDIO
// ============================================================
async function processAudioMessage(phone,msg,senderJid,waSocket) {
    const step=getSession(phone).step;
    if(step==="book_name") return "🎙️ *Nota de voz recibida.*\n\nPara garantizar que tu nombre quede correcto en la orden, por favor *escribelo por texto*.";
    if(step==="book_phone") return "🎙️ *Nota de voz recibida.*\n\nPor favor *escribe tu numero de celular* (10 digitos, ej: 0987654321).";
    if(["book_address","book_canton","book_parish"].includes(step)) return "🎙️ *Nota de voz recibida.*\n\nPor favor *escribe tu direccion y canton* por texto.";
    if(["book_date","book_time"].includes(step)) return "🎙️ *Nota de voz recibida.*\n\nPor favor indica tu *fecha y hora preferida* por texto.";
    if(step==="awaiting_availability_confirm") return "🎙️ *Nota de voz recibida.*\n\nPara confirmar, responde *SI* o *NO* por texto.";
    setSession(phone,"main_menu",{senderJid,fromAudio:true});
    return "🎙️ *¡Nota de voz recibida en HIDROSYS EC.!*\n\nTe asistimos de inmediato:\n\n1️⃣ Agendar Visita Tecnica\n2️⃣ Reportar Comprobante de Pago\n3️⃣ Consultar Estado de Cita\n4️⃣ Ver Catalogo de Servicios\n\n👉 _Responde con el numero de tu opcion._";
}

module.exports = { processMessage, processPollVote, buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage, processAudioMessage, clearSession, setSession };