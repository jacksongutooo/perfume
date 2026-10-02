/* =====================================================================
   Servidor local para testar a página e o checkout sem cobrança real.
   Não é publicado (a pasta dev/ está no .vercelignore).

   Uso (na pasta do projeto, com Node 18 ou mais novo):

     node dev/servidor-local.js
       -> http://localhost:3000 com a API do PIX SIMULADA:
          o PIX é falso e o pagamento é "aprovado" sozinho depois de
          25 segundos (mude com PAGAR_EM=10). Para aprovar na hora:
          http://localhost:3000/__pagar  (aprova o último PIX gerado)

     node dev/servidor-local.js --real
       -> usa as funções verdadeiras da pasta api/. Precisa das variáveis
          de ambiente (KV_REST_API_URL, KV_REST_API_TOKEN...). Use sempre
          PAYMENTS_ENABLED=false para não criar cobrança de verdade.

   Porta: PORTA=8080 node dev/servidor-local.js
   ===================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..');
const PORTA = Number(process.env.PORTA || 3000);
const REAL = process.argv.includes('--real');
const PAGAR_EM = Number(process.env.PAGAR_EM || 25) * 1000;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

/* ---------------- API simulada ---------------- */
const VALORES = { single: 4990, double: 7990, triple: 9700 };
const pedidos = new Map();     // transactionId -> pedido
let ultimo = null;

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((resolve) => {
    const partes = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); }
      catch (e) { resolve(null); }
    });
  });
}

async function simularCriacao(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { ok: false, error: 'Método não permitido.' });
  const corpo = await lerCorpo(req);
  if (!corpo || !VALORES[corpo.plan]) return responder(res, 400, { ok: false, error: 'Opção de compra inválida.' });
  if (!corpo.customer || !corpo.customer.cpf) return responder(res, 400, { ok: false, error: 'Informe um CPF válido.' });

  const transactionId = 'tx_' + crypto.randomBytes(6).toString('hex');
  const externalRef = 'TESTE-' + Date.now().toString(36).toUpperCase();
  const token = crypto.randomBytes(16).toString('hex');
  const pedido = {
    transactionId, externalRef, token, status: 'PENDING_PAYMENT',
    amount: VALORES[corpo.plan], criadoEm: Date.now(), plano: corpo.plan,
    produtos: corpo.selectedProducts, utm: corpo.utm
  };
  pedidos.set(transactionId, pedido);
  ultimo = pedido;
  console.log('[api simulada] PIX gerado', externalRef, '| plano', corpo.plan, '| utm', JSON.stringify(corpo.utm || {}));

  responder(res, 200, {
    ok: true, testMode: true, amount: pedido.amount, externalRef, transactionId, token,
    pix: {
      copyPaste: '00020101021226850014br.gov.bcb.pix2563pix.exemplo.com/qr/v2/TESTE-NAO-PAGUE-' + transactionId + '5204000053039865802BR5925LOJA TESTE6009SAO PAULO62070503***6304ABCD',
      qrCode: null, qrCodeBase64: null,
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString()
    }
  });
}

function simularStatus(req, res) {
  const url = new URL(req.url, 'http://local');
  const pedido = pedidos.get(url.searchParams.get('transactionId') || '');
  if (!pedido) return responder(res, 200, { status: 'UNKNOWN' });
  if (pedido.token !== url.searchParams.get('token')) return responder(res, 403, { ok: false, error: 'Consulta inválida.' });
  if (pedido.status === 'PENDING_PAYMENT' && PAGAR_EM > 0 && Date.now() - pedido.criadoEm > PAGAR_EM) pedido.status = 'PAID';
  responder(res, 200, { status: pedido.status });
}

function simularPagamento(req, res) {
  if (!ultimo) return responder(res, 404, { ok: false, error: 'Nenhum PIX gerado ainda.' });
  ultimo.status = 'PAID';
  console.log('[api simulada] pagamento aprovado', ultimo.externalRef);
  responder(res, 200, { ok: true, pago: ultimo.externalRef });
}

/* ---------------- API verdadeira (--real) ---------------- */
function funcaoReal(nome) {
  const arquivo = path.join(RAIZ, 'api', nome + '.js');
  return require(arquivo);
}

/* ---------------- arquivos estáticos ---------------- */
function servirArquivo(req, res) {
  let caminho = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (caminho.endsWith('/')) caminho += 'index.html';
  const arquivo = path.normalize(path.join(RAIZ, caminho));
  if (!arquivo.startsWith(RAIZ + path.sep) || /[\\/](api|dev|\.git)([\\/]|$)/.test(arquivo.slice(RAIZ.length))) {
    res.statusCode = 404; return res.end('Não encontrado');
  }
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) { res.statusCode = 404; return res.end('Não encontrado'); }
    res.setHeader('Content-Type', TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(dados);
  });
}

http.createServer(async (req, res) => {
  const rota = new URL(req.url, 'http://local').pathname;
  try {
    if (rota === '/api/create-payment') return REAL ? funcaoReal('create-payment')(req, res) : simularCriacao(req, res);
    if (rota === '/api/payment-status') return REAL ? funcaoReal('payment-status')(req, res) : simularStatus(req, res);
    if (rota === '/api/blackcat-webhook' && REAL) return funcaoReal('blackcat-webhook')(req, res);
    if (rota === '/__pagar' && !REAL) return simularPagamento(req, res);
    return servirArquivo(req, res);
  } catch (e) {
    console.error(e);
    responder(res, 500, { ok: false, error: 'Erro no servidor local.' });
  }
}).listen(PORTA, () => {
  console.log('Bodyman rodando em http://localhost:' + PORTA + (REAL ? '  (API verdadeira)' : '  (API do PIX simulada)'));
  if (!REAL) console.log((PAGAR_EM > 0 ? 'Pagamento simulado aprovado após ' + PAGAR_EM / 1000 + ' s. ' : 'Aprovação automática desligada. ') + 'Para aprovar na hora: http://localhost:' + PORTA + '/__pagar');
});
