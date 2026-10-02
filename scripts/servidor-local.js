/* =====================================================================
   SERVIDOR LOCAL DE TESTE — sem dependências, só Node 18+.

   Uso:   node scripts/servidor-local.js
   Abre:  http://localhost:3000

   - Serve os arquivos estáticos da pasta do projeto.
   - Encaminha /api/* para as mesmas funções que rodam na Vercel.
   - Roda SEMPRE em modo de teste (PAYMENTS_ENABLED=false): nenhuma
     cobrança real é criada e a BlackCat não é chamada. Para testar contra a
     BlackCat de verdade, use `vercel dev` com as variáveis configuradas.
   - Sem KV configurado, os pedidos ficam em memória enquanto o servidor
     estiver rodando.

   Atalho só deste servidor local (não existe no site publicado):
     http://localhost:3000/__teste/pagar?transactionId=TESTE-...
   simula o webhook de pagamento aprovado para aquele PIX de teste, e a
   tela do checkout confirma sozinha na próxima consulta.
   ===================================================================== */
'use strict';

process.env.PAYMENTS_ENABLED = 'false';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RAIZ = path.resolve(__dirname, '..');
const PORTA = Number(process.env.PORT || 3000);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function rotaApi(nome) {
  if (!/^[a-z0-9-]+$/i.test(nome)) return null;      // nada de ../ nem _modulos
  const arquivo = path.join(RAIZ, 'api', nome + '.js');
  return fs.existsSync(arquivo) ? arquivo : null;
}

function servirArquivo(req, res, caminho) {
  let alvo = path.normalize(path.join(RAIZ, decodeURIComponent(caminho)));
  if (alvo.indexOf(RAIZ) !== 0) { res.statusCode = 403; return res.end('403'); }
  if (fs.existsSync(alvo) && fs.statSync(alvo).isDirectory()) alvo = path.join(alvo, 'index.html');
  if (!fs.existsSync(alvo)) { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('404 — não encontrado'); }
  const tipo = TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream';
  res.setHeader('Content-Type', tipo);
  res.setHeader('Cache-Control', 'no-store');
  /* compacta textos como a Vercel faz em produção */
  if (/text|javascript|json|svg|xml/.test(tipo) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    res.setHeader('Content-Encoding', 'gzip');
    return fs.createReadStream(alvo).pipe(zlib.createGzip()).pipe(res);
  }
  fs.createReadStream(alvo).pipe(res);
}

/* Simula o webhook "transaction.paid" chamando o handler real. */
function simularPagamento(transactionId, res) {
  const corpo = JSON.stringify({ type: 'transaction.paid', data: { id: transactionId, status: 'paid' } });
  const req = require('stream').Readable.from([Buffer.from(corpo)]);
  req.method = 'POST';
  req.url = '/api/blackcat-webhook';
  req.headers = { 'content-type': 'application/json' };
  const webhook = require(path.join(RAIZ, 'api', 'blackcat-webhook.js'));
  return webhook(req, res);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/__teste/pagar') {
      const tx = url.searchParams.get('transactionId') || '';
      if (!/^TESTE-/.test(tx)) { res.statusCode = 400; return res.end('Informe ?transactionId=TESTE-...'); }
      return await simularPagamento(tx, res);
    }
    const api = url.pathname.match(/^\/api\/([^/]+)\/?$/);
    if (api) {
      const arquivo = rotaApi(api[1]);
      if (!arquivo) { res.statusCode = 404; return res.end('{"ok":false}'); }
      return await require(arquivo)(req, res);
    }
    return servirArquivo(req, res, url.pathname);
  } catch (e) {
    console.error('[servidor-local]', e);
    if (!res.headersSent) res.statusCode = 500;
    res.end('500');
  }
});

servidor.listen(PORTA, () => {
  console.log('Bodyman em modo de teste: http://localhost:' + PORTA);
  console.log('Nenhuma cobrança real é criada neste servidor.');
});
