/**
 * POST /api/blackcat-webhook
 *
 * Recebe as mudanças de status da BlackCat. Responde 200 rápido e não faz
 * nada pesado antes de responder. Idempotente por transactionId.
 *
 * Segurança: o corpo do webhook nunca é a palavra final. Antes de marcar
 * como pago, o status é confirmado na própria API da BlackCat.
 * Se BLACKCAT_WEBHOOK_SECRET estiver definido, também exigimos o segredo
 * em ?secret= ou no cabeçalho X-Webhook-Secret.
 */
const { json, lerCorpo } = require('./_http');
const { PAYMENTS_ENABLED } = require('./_config');
const store = require('./_store');
const blackcat = require('./_blackcat');

const SEGREDO = process.env.BLACKCAT_WEBHOOK_SECRET || '';

function acharTransacao(corpo) {
  if (!corpo || typeof corpo !== 'object') return {};
  return corpo.data || corpo.transaction || corpo.sale || corpo;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false });
  }

  if (SEGREDO) {
    const url = new URL(req.url, 'https://local');
    const enviado = url.searchParams.get('secret') || req.headers['x-webhook-secret'] || '';
    if (enviado !== SEGREDO) {
      console.warn('[webhook] segredo inválido');
      return json(res, 401, { ok: false });
    }
  }

  const corpo = await lerCorpo(req);
  const evento = String((corpo && (corpo.type || corpo.event || corpo.eventName)) || '').toLowerCase();
  const t = acharTransacao(corpo);

  const transactionId = String(blackcat.primeiro(t.id, t.transactionId, t.transaction_id, '') || '');
  const externalRef = String(blackcat.primeiro(t.externalRef, t.externalReference, t.external_reference, '') || '');
  const statusBruto = blackcat.primeiro(t.status, t.paymentStatus, evento.split('.').pop());
  const status = blackcat.normalizarStatus(statusBruto);

  console.log('[webhook] evento:', evento || '(sem tipo)', '| tx:', transactionId || '-',
    '| ref:', externalRef || '-', '| status:', status);

  if (!transactionId && !externalRef) return json(res, 200, { ok: true, ignored: true });

  try {
    let pedido = null;
    if (transactionId) pedido = await store.lerPedidoPorTransacao(transactionId);
    if (!pedido && externalRef) pedido = await store.lerPedido(externalRef);

    if (!pedido) {
      console.warn('[webhook] pedido não encontrado para tx', transactionId, 'ref', externalRef);
      return json(res, 200, { ok: true, ignored: true });
    }

    if (status !== 'PAID') {
      if (status !== pedido.status) await store.atualizarPedido(pedido.externalRef, { status });
      return json(res, 200, { ok: true });
    }

    // Idempotência: só o primeiro webhook de pagamento é processado.
    const primeiraVez = await store.marcarPagamentoProcessado(pedido.transactionId || transactionId);
    if (!primeiraVez) {
      console.log('[webhook] transaction.paid repetido, ignorado:', pedido.externalRef);
      return json(res, 200, { ok: true, duplicate: true });
    }

    // Confirma na origem antes de dar o pedido como pago.
    let confirmado = true;
    if (PAYMENTS_ENABLED && blackcat.temChave() && pedido.transactionId) {
      try {
        const r = await blackcat.consultarStatus(pedido.transactionId);
        if (r.ok) {
          const d = blackcat.extrairVenda(r.corpo);
          confirmado = blackcat.normalizarStatus(blackcat.primeiro(d.status, d.paymentStatus)) === 'PAID';
        }
      } catch (e) {
        console.error('[webhook] não deu para confirmar na API:', e.message);
      }
    }

    if (!confirmado) {
      console.warn('[webhook] pagamento não confirmado na API, pedido mantido pendente:', pedido.externalRef);
      return json(res, 200, { ok: true, unconfirmed: true });
    }

    const e2e = blackcat.primeiro(t.endToEndId, t.end_to_end_id, t.e2eId,
      (t.paymentData && (t.paymentData.endToEndId || t.paymentData.end_to_end_id)));

    await store.atualizarPedido(pedido.externalRef, {
      status: 'PAID',                     // pago não é enviado: postagem muda o status depois
      paidAt: new Date().toISOString(),
      endToEndId: e2e || null
    });

    console.log('[webhook] PAGAMENTO CONFIRMADO:', pedido.externalRef, '| tx:', pedido.transactionId,
      '| valor:', pedido.amount, '| plano:', pedido.plan);

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('[webhook] erro ao processar:', e.message);
    return json(res, 500, { ok: false });   // 500 faz a BlackCat tentar de novo
  }
};
