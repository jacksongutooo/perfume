/**
 * Persistência dos pedidos.
 *
 * Usa Redis (Vercel KV / Upstash) pela API REST, sem instalar biblioteca.
 * Basta cadastrar na Vercel as variáveis:
 *   KV_REST_API_URL   (ou UPSTASH_REDIS_REST_URL)
 *   KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_TOKEN)
 * Conectando um banco KV/Upstash no painel da Vercel, elas são criadas sozinhas.
 *
 * Sem essas variáveis o módulo cai num armazenamento em memória que NÃO é
 * persistente — cada invocação serverless tem a sua própria cópia. Serve só
 * para desenvolvimento e avisa em todo log. Ative o KV antes de vender.
 */

const URL_REST = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN_REST = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const PERSISTENTE = Boolean(URL_REST && TOKEN_REST);

// 60 dias: tempo de vida de um pedido no armazenamento.
const TTL = 60 * 60 * 24 * 60;

const memoria = new Map();
let avisou = false;
function avisarMemoria() {
  if (avisou) return;
  avisou = true;
  console.warn('[store] KV não configurado: pedidos ficam apenas em memória e se perdem entre invocações. Configure KV_REST_API_URL e KV_REST_API_TOKEN na Vercel.');
}

async function comando(args) {
  const resposta = await fetch(URL_REST, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN_REST, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!resposta.ok) throw new Error('KV HTTP ' + resposta.status);
  const dados = await resposta.json();
  if (dados && dados.error) throw new Error('KV: ' + dados.error);
  return dados ? dados.result : null;
}

async function set(chave, valor, opcoes) {
  if (!PERSISTENTE) {
    avisarMemoria();
    if (opcoes && opcoes.nx && memoria.has(chave)) return false;
    memoria.set(chave, valor);
    return true;
  }
  const args = ['SET', chave, valor, 'EX', String(TTL)];
  if (opcoes && opcoes.nx) args.push('NX');
  const r = await comando(args);
  return r === 'OK';
}

async function get(chave) {
  if (!PERSISTENTE) { avisarMemoria(); return memoria.has(chave) ? memoria.get(chave) : null; }
  return comando(['GET', chave]);
}

const chavePedido = (ref) => 'pedido:' + ref;
const chaveTransacao = (id) => 'tx:' + id;
const chaveIdempotencia = (id) => 'pago:' + id;

async function salvarPedido(pedido) {
  await set(chavePedido(pedido.externalRef), JSON.stringify(pedido));
  if (pedido.transactionId) await set(chaveTransacao(pedido.transactionId), pedido.externalRef);
  return pedido;
}

async function lerPedido(externalRef) {
  const bruto = await get(chavePedido(externalRef));
  if (!bruto) return null;
  try { return typeof bruto === 'string' ? JSON.parse(bruto) : bruto; }
  catch (e) { return null; }
}

async function lerPedidoPorTransacao(transactionId) {
  const ref = await get(chaveTransacao(transactionId));
  return ref ? lerPedido(ref) : null;
}

async function atualizarPedido(externalRef, mudancas) {
  const atual = await lerPedido(externalRef);
  if (!atual) return null;
  const novo = Object.assign({}, atual, mudancas, { updatedAt: new Date().toISOString() });
  await salvarPedido(novo);
  return novo;
}

/** Idempotência: devolve true só na primeira vez que o transactionId é pago. */
async function marcarPagamentoProcessado(transactionId) {
  return set(chaveIdempotencia(transactionId), new Date().toISOString(), { nx: true });
}

module.exports = {
  PERSISTENTE,
  salvarPedido, lerPedido, lerPedidoPorTransacao, atualizarPedido,
  marcarPagamentoProcessado
};
