/**
 * Utilitários HTTP compartilhados pelas funções serverless.
 * Regra: o cliente nunca recebe stack trace, payload bruto nem nome de variável interna.
 */

function json(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

function erroAmigavel(res, status, mensagem, contextoInterno) {
  if (contextoInterno) console.error('[checkout]', mensagem, '|', contextoInterno);
  json(res, status, { ok: false, error: mensagem });
}

/** Lê o corpo da requisição. A Vercel normalmente já entrega req.body. */
async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  const pedacos = [];
  for await (const p of req) pedacos.push(p);
  if (!pedacos.length) return {};
  try { return JSON.parse(Buffer.concat(pedacos).toString('utf8')); }
  catch (e) { return null; }
}

function somenteMetodo(req, res, metodo) {
  if (req.method === metodo) return true;
  res.setHeader('Allow', metodo);
  json(res, 405, { ok: false, error: 'Método não permitido.' });
  return false;
}

/** Mascara dados sensíveis antes de qualquer log. */
function mascarar(texto, visivel = 3) {
  const t = String(texto || '');
  if (t.length <= visivel) return '*'.repeat(t.length);
  return t.slice(0, visivel) + '*'.repeat(t.length - visivel);
}

module.exports = { json, erroAmigavel, lerCorpo, somenteMetodo, mascarar };
