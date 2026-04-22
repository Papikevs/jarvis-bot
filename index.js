require('dotenv').config();
const { Telegraf } = require('telegraf');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');

const bot = new Telegraf(process.env.BOT_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const JARVIS = `Eres Jarvis, COO personal de Kevin Mendes, 27 anos, emprendedor venezolano, Chairman de un holding de 5 empresas. Tu funcion es supervisar todos los CEOs, dar reportes consolidados del holding y alertar a Kevin sobre lo urgente. Eres formal, estrategico, directo y nunca vago. Las 5 empresas son: 1) Capital Sports Santa Fe - padel center premium, conflicto accionario activo, bloque Mendes 43% vs Peraza 57%, 9 meses sin junta, legal Bufete Galea. 2) Capital Sports Eurobuilding - padel center, GCS 51% Gabrielle Rosa 49%. 3) Venezuela Padel Tour - circuito nacional padel, GCS 50% Juan Andres Perez 50%. 4) Agencia 58 - agencia de viajes 1 ano operativa, en crecimiento. 5) Cambionet - casa de cambio. Prioridades de Kevin: resolver conflicto GCS, cerrar sponsorships VTW mayo 2026, crecer Agencia 58, ordenar Cambionet.`;

const EMPRESAS = {
  santafe: `Eres el CEO de Capital Sports Santa Fe, premium padel center en Santa Fe, Caracas. Tu funcion principal es monitorear y optimizar la administracion. Cada noche Kevin te envia 4 archivos: facturas del punto de venta, Excel con ventas del dia por area, relacion de ventas del sistema, y PDF de Matchpoint con reservas del dia. Con esa informacion generas un reporte matutino ejecutivo que incluye: 1) Resumen de ingresos del dia por area, 2) Alertas de irregularidades, 3) Comparacion con dias anteriores, 4) Recomendaciones concretas de administracion compras y personal, 5) Una accion prioritaria para el dia. Accionistas: 24% Jorge Peraza, 24% Andres Peraza, 20% Kevin Mendes Vicepresidente, 20% Miguel Mendes, 5% Alejandro Doza, 3% Danny Mendes, 3% Eduardo Robertson, 1% David Brito. Conflicto accionario activo - proteges intereses del bloque Mendes. Legal: Bufete Galea. Eres formal, analitico, directo.`,
  eurobuilding: `Eres el CEO de Capital Sports Eurobuilding, sede en Hotel Eurobuilding Caracas. Tu funcion principal es monitorear y optimizar la administracion. Cada noche Kevin te envia 4 archivos: facturas del punto de venta, Excel con ventas del dia por area, relacion de ventas del sistema, y PDF de Matchpoint con reservas. Generas reporte matutino con: 1) Resumen de ingresos por area, 2) Alertas de irregularidades, 3) Comparacion con dias anteriores, 4) Recomendaciones concretas, 5) Accion prioritaria del dia. Accionistas: GCS 51%, Gabrielle Rosa 49%. Eres formal, analitico, directo.`,
  vpt: `Eres el CEO de Venezuela Padel Tour, primer circuito nacional de padel en Venezuela. Fundado 2022. En 2025: 15 torneos, 10 ciudades, mas de 10000 jugadores, expansion a Miami. Accionistas: GCS 50%, Juan Andres Perez 50%. Tu foco es crecimiento del circuito, organizacion de eventos, inscripciones y patrocinios. Eres formal, estrategico, orientado al crecimiento.`,
  agencia58: `Eres el CEO de Agencia 58, agencia de viajes y experiencias en Venezuela. 1 ano operativa, etapa temprana. Tu mision es crecer la empresa. Tienes equipo de marketing, guionista de contenido y cotizador de pasajes. Das recomendaciones de crecimiento, marketing y operaciones. Si Kevin pide cotizar un viaje das opciones y precios aproximados. Si pide contenido generas guiones. Eres dinamico, creativo, orientado a resultados.`,
  cambionet: `Eres el CEO y Administrador de Cambionet, casa de cambio en Venezuela. Manejas USD, EUR, Bs y USDT. Tu prioridad es ordenar finanzas, controlar flujo de caja y alertar sobre riesgos. Eres formal, analitico y muy preciso con los numeros.`
};

const convs = {};
function getE(id) { if (!convs[id]) convs[id] = { emp: null, hist: [], contexto: null }; return convs[id]; }

async function guardarConversacion(empresa, rol, contenido) {
  try { await supabase.from('conversaciones').insert({ empresa, rol, contenido }); } catch (e) { console.error('Error guardando:', e.message); }
}

async function guardarDocumento(empresa, nombre, contenido) {
  try { await supabase.from('documentos').insert({ empresa, nombre, contenido }); } catch (e) { console.error('Error guardando doc:', e.message); }
}

async function obtenerContexto(empresa) {
  try {
    const { data: docs } = await supabase.from('documentos').select('nombre, contenido').eq('empresa', empresa).order('fecha', { ascending: false }).limit(5);
    const { data: historial } = await supabase.from('conversaciones').select('contenido').eq('empresa', empresa).order('fecha', { ascending: false }).limit(15);

    let contexto = '';

    if (docs && docs.length > 0) {
      contexto += '\n\nDOCUMENTOS CARGADOS POR KEVIN:\n';
      docs.forEach(d => {
        contexto += `\nArchivo: ${d.nombre}\n${d.contenido}\n`;
      });
    }

    if (historial && historial.length > 0) {
      contexto += '\n\nHISTORIAL PREVIO:\n';
      contexto += historial.reverse().map(x => x.contenido).join('\n');
    }

    return contexto;
  } catch (e) { return ''; }
}

async function preguntar(sistema, historial, mensaje) {
  try {
    const msgs = [{ role: 'system', content: sistema }, ...historial, { role: 'user', content: mensaje }];
    const r = await groq.chat.completions.create({ messages: msgs, model: 'llama-3.3-70b-versatile', max_tokens: 2048 });
    return r.choices[0].message.content;
  } catch (e) {
    console.error('ERROR GROQ:', e.message);
    return 'Error al procesar. Intenta de nuevo.';
  }
}

async function activarEmpresa(ctx, emp, mensaje) {
  const e = getE(ctx.chat.id);
  e.emp = emp; e.hist = [];
  const contexto = await obtenerContexto(emp);
  e.contexto = EMPRESAS[emp] + contexto;
  await ctx.reply(mensaje);
}

async function descargarArchivo(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

async function procesarArchivo(buffer, nombre) {
  try {
    const ext = nombre.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      const data = await pdfParse(buffer);
      return data.text.slice(0, 4000);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let texto = '';
      workbook.SheetNames.forEach(sheet => {
        const ws = workbook.Sheets[sheet];
        texto += `Hoja: ${sheet}\n${XLSX.utils.sheet_to_csv(ws)}\n\n`;
      });
      return texto.slice(0, 4000);
    }
    return null;
  } catch (e) {
    console.error('Error procesando archivo:', e.message);
    return null;
  }
}

const teclado = { reply_markup: { keyboard: [['Jarvis', 'Resumen'], ['Santa Fe', 'Eurobuilding'], ['VPT', 'Agencia 58'], ['Cambionet', 'Inicio']], resize_keyboard: true } };

bot.start(async (ctx) => {
  const e = getE(ctx.chat.id);
  e.emp = null; e.hist = []; e.contexto = null;
  await ctx.reply('JARVIS en linea.\n\nCon quien quieres hablar?', teclado);
});

bot.on('text', async (ctx) => {
  const t = ctx.message.text; const e = getE(ctx.chat.id);
  if (t === 'Inicio') { e.emp = null; e.hist = []; e.contexto = null; return ctx.reply('Con quien quieres hablar?', teclado); }
  if (t === 'Jarvis') { e.emp = 'jarvis'; e.hist = []; e.contexto = null; return ctx.reply('Jarvis activado. A su servicio, Kevin.'); }
  if (t === 'Resumen') {
    e.emp = 'jarvis';
    await ctx.reply('Generando resumen del holding...');
    const r = await preguntar(JARVIS, [], 'Dame un resumen ejecutivo del estado actual de las 5 empresas. Destaca lo urgente primero.');
    e.hist = [{ role: 'user', content: 'Resumen' }, { role: 'assistant', content: r }];
    await guardarConversacion('holding', 'jarvis', r);
    return ctx.reply(r);
  }
  if (t === 'Santa Fe') return activarEmpresa(ctx, 'santafe', 'CEO Capital Sports Santa Fe en linea.\n\nTengo acceso a documentos e historial previo. Puedes enviarme archivos o consultarme sobre administracion, personal, compras o finanzas.');
  if (t === 'Eurobuilding') return activarEmpresa(ctx, 'eurobuilding', 'CEO Capital Sports Eurobuilding en linea.\n\nTengo acceso a documentos e historial previo. Puedes enviarme archivos o consultarme.');
  if (t === 'VPT') return activarEmpresa(ctx, 'vpt', 'CEO Venezuela Padel Tour en linea.\n\nEn que le puedo ayudar?');
  if (t === 'Agencia 58') return activarEmpresa(ctx, 'agencia58', 'CEO Agencia 58 en linea.\n\nPuedo cotizar viajes, generar contenido o ayudarle con la estrategia.');
  if (t === 'Cambionet') return activarEmpresa(ctx, 'cambionet', 'CEO Cambionet en linea.\n\nEn que le puedo ayudar con las finanzas?');
  if (!e.emp) return ctx.reply('Con quien quieres hablar?', teclado);
  await ctx.sendChatAction('typing');
  const sys = e.emp === 'jarvis' ? JARVIS : (e.contexto || EMPRESAS[e.emp]);
  const r = await preguntar(sys, e.hist, t);
  e.hist.push({ role: 'user', content: t }); e.hist.push({ role: 'assistant', content: r });
  if (e.hist.length > 20) e.hist = e.hist.slice(-20);
  await guardarConversacion(e.emp, 'chat', `Usuario: ${t} | Respuesta: ${r}`);
  await ctx.reply(r);
});

bot.on('photo', async (ctx) => {
  const e = getE(ctx.chat.id);
  const caption = ctx.message.caption || 'Analiza esta imagen';
  await ctx.sendChatAction('typing');
  const empresa = e.emp || 'jarvis';
  const sys = empresa === 'jarvis' ? JARVIS : (e.contexto || EMPRESAS[empresa]);
  const r = await preguntar(sys, e.hist, `Kevin envio una imagen con mensaje: "${caption}". Analiza y responde.`);
  e.hist.push({ role: 'user', content: caption }); e.hist.push({ role: 'assistant', content: r });
  await guardarDocumento(empresa, 'imagen', caption);
  await ctx.reply(r);
});

bot.on('document', async (ctx) => {
  const e = getE(ctx.chat.id);
  const caption = ctx.message.caption || '';
  const nombre = ctx.message.document.file_name || 'documento';
  await ctx.sendChatAction('typing');
  const empresa = e.emp || 'jarvis';
  const sys = empresa === 'jarvis' ? JARVIS : (e.contexto || EMPRESAS[empresa]);
  try {
    await ctx.reply(`Procesando ${nombre}...`);
    const buffer = await descargarArchivo(ctx, ctx.message.document.file_id);
    const contenido = await procesarArchivo(buffer, nombre);
    if (contenido) {
      const prompt = `Kevin envio el archivo "${nombre}"${caption ? ` con mensaje: "${caption}"` : ''}.\n\nCONTENIDO:\n${contenido}\n\nAnaliza en detalle y da reporte completo con hallazgos, alertas y recomendaciones concretas.`;
      const r = await preguntar(sys, e.hist, prompt);
      e.hist.push({ role: 'user', content: `Archivo: ${nombre}` }); e.hist.push({ role: 'assistant', content: r });
      await guardarDocumento(empresa, nombre, contenido);
      await ctx.reply(r);
    } else {
      await ctx.reply(`El archivo "${nombre}" no es PDF ni Excel. Por favor envia archivos en formato PDF, XLS o XLSX.`);
    }
  } catch (err) {
    console.error('Error procesando documento:', err.message);
    await ctx.reply('Hubo un error procesando el archivo. Intenta de nuevo.');
  }
});

bot.launch().then(() => console.log('Jarvis en linea con memoria y lectura de archivos')).catch(err => console.error(err));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
