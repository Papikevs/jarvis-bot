require('dotenv').config();
const { Telegraf } = require('telegraf');
const Groq = require('groq-sdk');
const bot = new Telegraf(process.env.BOT_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const JARVIS = 'Eres Jarvis, COO personal de Kevin Mendes, emprendedor venezolano, Chairman de 5 empresas: Capital Sports Santa Fe, Capital Sports Eurobuilding, Venezuela Padel Tour, Agencia 58, Cambionet. Eres directo, honesto, estrategico, espanol venezolano.';
const EMPRESAS = {
  santafe: 'Eres CEO de Capital Sports Santa Fe. Padel premium Caracas. Conflicto accionario bloque Mendes 43% vs Peraza 57%. 9 meses sin junta. Legal Bufete Galea. Reportas a Kevin.',
  eurobuilding: 'Eres CEO de Capital Sports Eurobuilding. Hotel Eurobuilding Caracas. GCS 51%, Gabrielle Rosa 49%. Reportas a Kevin.',
  vpt: 'Eres CEO de Venezuela Padel Tour. Primer circuito padel Venezuela. GCS 50%, Juan Andres Perez 50%. Reportas a Kevin.',
  agencia58: 'Eres CEO de Agencia 58, agencia de viajes Venezuela. 1 ano operativa. Mision: crecer. Reportas a Kevin.',
  cambionet: 'Eres CEO de Cambionet, casa de cambio Venezuela. Priorizas finanzas. Reportas a Kevin.'
};
const convs = {};
function getE(id) { if (!convs[id]) convs[id] = { emp: null, hist: [] }; return convs[id]; }
async function preguntar(sistema, historial, mensaje) {
  try {
    const msgs = [{ role: 'system', content: sistema }, ...historial, { role: 'user', content: mensaje }];
    const r = await groq.chat.completions.create({ messages: msgs, model: 'llama-3.3-70b-versatile', max_tokens: 1024 });
    return r.choices[0].message.content;
  } catch (e) {
    console.error('ERROR:', e.message);
    return 'Error al procesar. Intenta de nuevo.';
  }
}
const teclado = { reply_markup: { keyboard: [['Jarvis', 'Resumen'], ['Santa Fe', 'Eurobuilding'], ['VPT', 'Agencia 58'], ['Cambionet', 'Inicio']], resize_keyboard: true } };
bot.start(async (ctx) => { const e = getE(ctx.chat.id); e.emp = null; e.hist = []; await ctx.reply('JARVIS en linea. Con quien quieres hablar?', teclado); });
bot.on('text', async (ctx) => {
  const t = ctx.message.text; const e = getE(ctx.chat.id);
  if (t === 'Inicio') { e.emp = null; e.hist = []; return ctx.reply('Con quien quieres hablar?', teclado); }
  if (t === 'Jarvis') { e.emp = 'jarvis'; e.hist = []; return ctx.reply('Jarvis activado. Que necesitas?'); }
  if (t === 'Resumen') {
    e.emp = 'jarvis';
    await ctx.reply('Generando resumen...');
    const r = await preguntar(JARVIS, [], 'Dame resumen ejecutivo de las 5 empresas. Directo, urgente primero.');
    e.hist = [{ role: 'user', content: 'Resumen' }, { role: 'assistant', content: r }];
    return ctx.reply(r);
  }
  if (t === 'Santa Fe') { e.emp = 'santafe'; e.hist = []; return ctx.reply('CEO Santa Fe en linea. En que te ayudo?'); }
  if (t === 'Eurobuilding') { e.emp = 'eurobuilding'; e.hist = []; return ctx.reply('CEO Eurobuilding en linea. Que necesitas?'); }
  if (t === 'VPT') { e.emp = 'vpt'; e.hist = []; return ctx.reply('CEO VPT en linea. En que te ayudo?'); }
  if (t === 'Agencia 58') { e.emp = 'agencia58'; e.hist = []; return ctx.reply('CEO Agencia 58 en linea. Que necesitas?'); }
  if (t === 'Cambionet') { e.emp = 'cambionet'; e.hist = []; return ctx.reply('CEO Cambionet en linea. Como te ayudo?'); }
  if (!e.emp) return ctx.reply('Con quien quieres hablar?', teclado);
  await ctx.sendChatAction('typing');
  const sys = e.emp === 'jarvis' ? JARVIS : EMPRESAS[e.emp];
  const r = await preguntar(sys, e.hist, t);
  e.hist.push({ role: 'user', content: t }); e.hist.push({ role: 'assistant', content: r });
  if (e.hist.length > 20) e.hist = e.hist.slice(-20);
  await ctx.reply(r);
});
bot.launch().then(() => console.log('Jarvis en linea')).catch(err => console.error(err));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));