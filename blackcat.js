/**
 * Cliente da BlackCat. A API Key vive só aqui, no servidor.
 */
const BASE = process.env.BLACKCAT_API_BASE || 'https://api.blackcatoficial.com';
const TIMEOUT = 15000;

function chave() {
  return process.env.BLACKCAT_API_KEY || '';
}

function temChave() {
  return Boolean(chave());
}

async function requisitar(caminho, opcoes) {
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TIMEOUT);
  try {
    const resposta = await fetch(BASE + caminho, Object.assign({}, opcoes, {
      signal: controle.signal,
      headers: Object.assign(
        { 'Content-Type': 'application/json', Accept: 'application/json', 'X-API-Key': chave() },
        (opcoes && opcoes.headers) || {}
      )
    }));

    const texto = await resposta.text();
    let corpo = null;
    try { corpo = texto ? JSON.parse(texto) : null; } catch (e) { corpo = { raw: texto }; }

    return { ok: resposta.ok, status: resposta.status, corpo };
  } finally {
    clearTimeout(limite);
  }
}

async function criarVenda(payload) {
  return requisitar('/api/sales/create-sale', { method: 'POST', body: JSON.stringify(payload) });
}

async function consultarStatus(transactionId) {
  return requisitar('/api/sales/' + encodeURIComponent(transactionId) + '/status', { method: 'GET' });
}

/** A resposta pode vir embrulhada em data/sale/transaction: desembrulha. */
function extrairVenda(corpo) {
  if (!corpo || typeof corpo !== 'object') return {};
  return corpo.data || corpo.sale || corpo.transaction || corpo;
}

function primeiro() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

/** Normaliza o que interessa da venda criada. */
function normalizarVenda(corpo) {
  const v = extrairVenda(corpo);
  const pd = v.paymentData || v.pix || v.payment || {};
  return {
    transactionId: String(primeiro(v.id, v.transactionId, v.transaction_id, v.saleId, '') || ''),
    status: normalizarStatus(primeiro(v.status, v.paymentStatus, 'pending')),
    amount: Number(primeiro(v.amount, v.value, 0)) || 0,
    invoiceUrl: primeiro(v.invoiceUrl, v.invoice_url, v.checkoutUrl) || null,
    pix: {
      qrCode: primeiro(pd.qrCode, pd.qr_code, pd.emv, pd.payload) || null,
      qrCodeBase64: primeiro(pd.qrCodeBase64, pd.qr_code_base64, pd.qrCodeImage, pd.base64) || null,
      copyPaste: primeiro(pd.copyPaste, pd.copy_paste, pd.qrCode, pd.qr_code, pd.emv, pd.payload) || null,
      expiresAt: primeiro(pd.expiresAt, pd.expires_at, v.expiresAt, v.expires_at) || null
    }
  };
}

/** Converte o status da BlackCat para os estados internos do pedido. */
function normalizarStatus(bruto) {
  const s = String(bruto || '').toLowerCase().trim();
  if (['paid', 'approved', 'completed', 'succeeded', 'success', 'pago'].indexOf(s) !== -1) return 'PAID';
  if (['refunded', 'refund', 'estornado'].indexOf(s) !== -1) return 'REFUNDED';
  if (['canceled', 'cancelled', 'refused', 'rejected', 'failed', 'chargeback', 'cancelado'].indexOf(s) !== -1) return 'CANCELLED';
  if (['expired', 'expirado'].indexOf(s) !== -1) return 'EXPIRED';
  return 'PENDING_PAYMENT';
}

module.exports = { criarVenda, consultarStatus, normalizarVenda, normalizarStatus, extrairVenda, temChave, primeiro };
