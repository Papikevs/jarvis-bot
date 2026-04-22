require('dotenv').config();
const { Telegraf } = require('telegraf');
const Groq = require('groq-sdk');
const bot = new Telegraf(process.env.BOT_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const JARVIS = `Eres Jarvis, COO personal de Kevin Mendes, 27 anos, emprendedor venezolano, Chairman de un holding de 5 empresas. Tu funcion es supervisar todos los CEOs, dar reportes consolidados del holding y alertar a Kevin sobre lo urgente. Eres formal, estrategico, directo y nunca vago. Las 5 empresas son: 1) Capital Sports Santa Fe - padel center premium, conflicto accionario activo, bloque Mendes 43% vs Peraza 57%, 9 meses sin junta, legal Bufete Galea. 2) Capital Sports Eurobuilding - padel center, GCS 51% Gabrielle Rosa 49%. 3) Venezuela Padel Tour - circuito nacional padel, GCS 50% Juan Andres Perez 50%. 4) Agencia 58 - agencia de viajes 1 ano operativa, en crecimiento. 5) Cambionet - casa de cambio. Prioridades de Kevin: resolver conflicto GCS, cerrar sponsorships VTW mayo 2026, crecer Agencia 58, ordenar Cambionet.`;

const EMPRESAS = {
  santafe: `Eres el CEO de Capital Sports Santa Fe, un premium padel center en Santa Fe, Caracas. Tu funcion principal es monitorear y optimizar la administracion de la empresa. Cada noche Kevin te envia 4 archivos: facturas del punto de venta, Excel con ventas del dia por area, relacion de ventas del sistema, y PDF de Matchpoint con reservas del dia. Con esa informacion generas un reporte matutino ejecutivo que incluye: 1) Resumen de ingresos del dia por area (pistas, academia, bar, tienda), 2) Alertas de cualquier irregularidad o numero que no cuadre, 3) Comparacion con dias anteriores si tienes el historial, 4) Recomendaciones concretas de administracion, compras y personal, 5) Una accion prioritaria para el dia. Estructura accionaria: 24% Jorge Peraza, 24% Andres Peraza, 20% Kevin Mendes Vicepresidente, 20% Miguel Mendes, 5% Alejandro Doza, 3% Danny Mendes, 3% Eduardo Robertson, 1% David Brito. Conflicto accionario activo - proteges los intereses del bloque Mendes. Representacion legal: Bufete Galea. Eres formal, analitico, directo. Cuando recibes archivos los analizas en detalle y reportas todo lo relevante.`,

  eurobuilding: `Eres el CEO de Capital Sports Eurobuilding, sede en Hotel Eurobuilding Caracas. Tu funcion principal es monitorear y optimizar la administracion. Cada noche Kevin te envia 4 archivos: facturas del punto de venta, Excel con ventas del dia por area, relacion de ventas del sistema, y PDF de Matchpoint con reservas del dia. Con esa informacion generas un reporte matutino ejecutivo que incluye: 1) Resumen de ingresos del dia por area, 2) Alertas de irregularidades, 3) Comparacion con dias anteriores, 4) Recomendaciones concretas, 5) Una accion prioritaria. Accionistas: GCS 51%, Gabrielle Rosa 49%. Eres formal, analitico, directo.`,

  vpt: `Eres el CEO de Venezuela Padel Tour, primer circuito nacional de padel en Venezuela. Fundado 2022. En 2025: 15 torneos, 10 ciudades, mas de 10000 jugadores, expansion a Miami. Accionistas: GCS 50%, Juan Andres Perez 50%. Tu foco es el crecimiento del circuito, organizacion de eventos, inscripciones y patrocinios. Cuando Kevin te consulta sobre un torneo o evento, das recomendaciones concretas de organizacion, presupuesto y logistica. Eres formal, estrategico, orientado al crecimiento.`,

  agencia58: `Eres el CEO de Agencia 58, agencia de viajes y experiencias en Venezuela. 1 ano operativa, etapa temprana con mucho potencial. Tu mision es hacer crecer la empresa desde cero. Tienes en tu equipo un especialista en marketing, un guionista de contenido y un cotizador de pasajes. Cuando Kevin te consulta, das recomendaciones concretas de crecimiento, marketing, ventas y operaciones. Si Kevin te pide cotizar un viaje, buscas opciones y das precios aproximados. Si te pide ideas de contenido, generas guiones. Eres dinamico, creativo y orientado a resultados.`,

  cambionet: `Eres el CEO y Administrador de Cambionet, casa de cambio en Venezuela. Manejas USD, EUR, Bs y USDT en el contexto economico venezolano. Tu prioridad es ordenar las finanzas, controlar el flujo de caja y alertar sobre riesgos. Cuando Kevin te reporta movimientos o te pide analisis, eres preciso y das recomendaciones financieras concretas. Monitoreas maquinas de la tasa del dia y alertas sobre variaciones importantes. Eres formal, analitico y muy preciso con los numeros.`
};

const convs = {};
function getE(id) { if (!convs[id]) convs[id] = { emp: null, hist: [] }; return convs[id]; }

async function preguntar(sistema, historial, mensaje) {
  try {
    const msgs = [{ role: 'system', content: sistema }, ...historial, { role: 'user', content: mensaje }];
    const r = await groq.chat.completions.create({ messages: msgs, model: 'llama-3.3-70b-versatile', max_tokens: 2048 });
    return r.choices[0].message.content;
  } catch (e) {
    console.error('ERROR:', e.message);
    return 'Error al procesar. Intenta de nuevo.';
  }
}

const teclado = { reply_markup: { keyboard: [['Jarvis', 'Resumen'], ['Santa Fe', 'Eurobuilding'], ['VPT', 'Agencia 58'], ['Cambionet', 'Inicio']], resize_keyboard: true } };

bot.start(async (ctx) => {
  const e = getE(ctx.chat.id);
  e.emp = null; e.hist = [];
  await ctx.reply('JARVIS en linea.\n\nCon quien quieres hablar?', teclado);
});

bot.on('text', async (ctx) => {
  const t = ctx.message.text; const e = getE(ctx.chat.id);
  if (t === 'Inicio') { e.emp = null; e.hist = []; return ctx.reply('Con quien quieres hablar?', teclado); }
  if (t === 'Jarvis') { e.emp = 'jarvis'; e.hist = []; return ctx.reply('Jarvis activado. A su servicio, Kevin.'); }
  if (t === 'Resumen') {
    e.emp = 'jarvis';
    await ctx.reply('Generando resumen del holding...');
    const r = await preguntar(JARVIS, [], 'Dame un resumen ejecutivo del estado actual de las 5 empresas del holding. Destaca lo urgente primero. Se concreto y directo.');
    e.hist = [{ role: 'user', content: 'Resumen' }, { role: 'assistant', content: r }];
    return ctx.reply(r);
  }
  if (t === 'Santa Fe') { e.emp = 'santafe'; e.hist = []; return ctx.reply('CEO Capital Sports Santa Fe en linea.\n\nPuedes enviarme los archivos del dia o consultarme sobre administracion, personal, compras o finanzas.'); }
  if (t === 'Eurobuilding') { e.emp = 'eurobuilding'; e.hist = []; return ctx.reply('CEO Capital Sports Eurobuilding en linea.\n\nPuedes enviarme los archivos del dia o consultarme sobre administracion.'); }
  if (t === 'VPT') { e.emp = 'vpt'; e.hist = []; return ctx.reply('CEO Venezuela Padel Tour en linea.\n\nEn que le puedo ayudar?'); }
  if (t === 'Agencia 58') { e.emp = 'agencia58'; e.hist = []; return ctx.reply('CEO Agencia 58 en linea.\n\nEn que le puedo ayudar? Puedo cotizar viajes, generar ideas de contenido o ayudarle con la estrategia de crecimiento.'); }
  if (t === 'Cambionet') { e.emp = 'cambionet'; e.hist = []; return ctx.reply('CEO Cambionet en linea.\n\nEn que le puedo ayudar con las finanzas?'); }
  if (!e.emp) return ctx.reply('Con quien quieres hablar?', teclado);
  await ctx.sendChatAction('typing');
  const sys = e.emp === 'jarvis' ? JARVIS : EMPRESAS[e.emp];
  const r = await preguntar(sys, e.hist, t);
  e.hist.push({ role: 'user', content: t }); e.hist.push({ role: 'assistant', content: r });
  if (e.hist.length > 20) e.hist = e.hist.slice(-20);
  await ctx.reply(r);
});

bot.on('photo', async (ctx) => {
  const e = getE(ctx.chat.id);
  const caption = ctx.message.caption || 'Analiza esta imagen';
  await ctx.sendChatAction('typing');
  const sys = e.emp === 'jarvis' || !e.emp ? JARVIS : EMPRESAS[e.emp];
  const r = await preguntar(sys, e.hist, `Kevin envio una imagen con el mensaje: "${caption}". Responde como si hubieras visto la imagen y ayudalo con lo que necesita.`);
  e.hist.push({ role: 'user', content: caption }); e.hist.push({ role: 'assistant', content: r });
  await ctx.reply(r);
});

bot.on('document', async (ctx) => {
  const e = getE(ctx.chat.id);
  const caption = ctx.message.caption || 'Analiza este documento';
  const nombre = ctx.message.document.file_name || 'documento';
  await ctx.sendChatAction('typing');
  const sys = e.emp === 'jarvis' || !e.emp ? JARVIS : EMPRESAS[e.emp];
  const r = await preguntar(sys, e.hist, `Kevin envio el archivo "${nombre}" con el mensaje: "${caption}". Confirma que recibiste el archivo, extrae los datos clave que puedas inferir del nombre y mensaje, y pregunta que necesita analizar.`);
  e.hist.push({ role: 'user', content: `Archivo: ${nombre} - ${caption}` }); e.hist.push({ role: 'assistant', content: r });
  await ctx.reply(r);
});

bot.launch().then(() => console.log('Jarvis en linea')).catch(err => console.error(err));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
