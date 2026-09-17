/**
 * GET /api/payment-status?transactionId=...&token=...
 *
 * O navegador nunca fala com a BlackCat: fala só com este endpoint.
 * O token é gerado junto com o pedido, então não dá para consultar
 * transações de outras pessoas.
 * Resposta: { status } e nada mais.
 */
const { json, erroAmigavel, somenteMetodo } = require('./_lib/http');
const { PAYMENTS_ENABLED } = require('./_lib/config');
const store = require('./_lib/store');
const blackcat = require('./_lib/blackcat');

const FINAIS = ['PAID', 'CANCELLED', 'REFUNDED', 'EXPIRED'];

module.exports = async function handler(req, res) {
  if (!somenteMetodo(req, res, 'GET')) return;

  const url = new URL(req.url, 'https://local');
  const transactionId = String(url.searchParams.get('transactionId') || '').trim();
  const token = String(url.searchParams.get('token') || '').trim();

  if (!transactionId || !token) return erroAmigavel(res, 400, 'Consulta inválida.');

  let pedido = null;
  try { pedido = await store.lerPedidoPorTransacao(transactionId); }
  catch (e) { console.error('[payment-status] falha ao ler pedido', e.message); }

  // Sem pedido gravado (KV desligado ou pedido expirado) não há como validar o dono.
  if (!pedido) return json(res, 200, { status: 'UNKNOWN' });

  if (pedido.publicToken !== token) return erroAmigavel(res, 403, 'Consulta inválida.');

  // Estado final já registrado (normalmente pelo webhook): responde direto.
  if (FINAIS.indexOf(pedido.status) !== -1) return json(res, 200, { status: pedido.status });

  if (!PAYMENTS_ENABLED || pedido.testMode) return json(res, 200, { status: pedido.status, testMode: true });

  if (!blackcat.temChave()) return json(res, 200, { status: pedido.status });

  let resposta;
  try {
    resposta = await blackcat.consultarStatus(transactionId);
  } catch (e) {
    console.error('[payment-status] falha de rede:', e.message);
    return json(res, 200, { status: pedido.status });   // mantém o polling vivo
  }

  if (!resposta.ok) {
    console.error('[payment-status] BlackCat respondeu', resposta.status);
    return json(res, 200, { status: pedido.status });
  }

  const dados = blackcat.extrairVenda(resposta.corpo);
  const status = blackcat.normalizarStatus(blackcat.primeiro(dados.status, dados.paymentStatus, pedido.status));

  if (status !== pedido.status) {
    const mudancas = { status };
    if (status === 'PAID') {
      mudancas.paidAt = pedido.paidAt || new Date().toISOString();
      const e2e = blackcat.primeiro(dados.endToEndId, dados.end_to_end_id, dados.e2eId);
      if (e2e) mudancas.endToEndId = e2e;
    }
    try { await store.atualizarPedido(pedido.externalRef, mudancas); }
    catch (e) { console.error('[payment-status] falha ao atualizar pedido', e.message); }
  }

  return json(res, 200, { status });
};
