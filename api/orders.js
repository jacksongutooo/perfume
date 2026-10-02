/**
 * GET /api/orders — lista os PIX gerados (pendentes e pagos) para
 * acompanhar o funil e recuperar pagamentos pendentes.
 *
 * DESLIGADA por padrão: só funciona com a variável de ambiente ADMIN_TOKEN
 * (24 caracteres ou mais) configurada na Vercel. Sem ela, responde 404.
 *
 * Uso (no navegador ou em planilha):
 *   /api/orders?token=SEU_ADMIN_TOKEN                 últimos 30 dias, JSON
 *   /api/orders?token=...&status=PENDING_PAYMENT      só PIX não pagos
 *   /api/orders?token=...&dias=7&formato=csv          planilha dos últimos 7 dias
 * O token também pode ir no cabeçalho  Authorization: Bearer SEU_ADMIN_TOKEN
 *
 * Esta rota só LÊ dados. Nenhuma mensagem é enviada a clientes.
 * Contatar alguém sobre um PIX pendente é uma decisão manual da loja.
 */
const crypto = require('crypto');
const { json, somenteMetodo } = require('./_http');
const store = require('./_store');

function tokenOk(req, url) {
  const esperado = process.env.ADMIN_TOKEN || '';
  if (esperado.length < 24) return null;                       // rota desligada
  const cabecalho = String(req.headers.authorization || '');
  const enviado = cabecalho.indexOf('Bearer ') === 0 ? cabecalho.slice(7) : (url.searchParams.get('token') || '');
  const a = Buffer.from(String(enviado));
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function reais(centavos) {
  return (Number(centavos || 0) / 100).toFixed(2).replace('.', ',');
}

function dataBR(iso) {
  const t = Date.parse(iso || '');
  if (isNaN(t)) return '';
  try {
    return new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch (e) { return iso; }
}

function cpfMascarado(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  return d.length === 11 ? '***.' + d.slice(3, 6) + '.***-' + d.slice(9) : '';
}

/** Linha enxuta de cada pedido, com o necessário para análise e recuperação. */
function resumir(p, agora) {
  const ctx = p.context || {};
  const utm = p.utm || {};
  const expira = Date.parse(p.pixExpiresAt || '');
  const vencido = p.status === 'PENDING_PAYMENT' && !isNaN(expira) && expira < agora;
  const telefone = String((p.customer && p.customer.phone) || '');
  return {
    pedido: p.externalRef,
    criadoEm: p.createdAt,
    criadoEmBR: dataBR(p.createdAt),
    status: p.status,
    situacao: p.status === 'PAID' ? 'pago'
      : vencido ? 'PIX vencido sem pagamento'
      : p.status === 'PENDING_PAYMENT' ? 'aguardando pagamento'
      : String(p.status || '').toLowerCase(),
    valor: reais(p.amount),
    plano: p.plan,
    produtos: (p.products || []).join(' + '),
    cliente: (p.customer && p.customer.name) || '',
    telefone,
    email: (p.customer && p.customer.email) || '',
    cpf: cpfMascarado(p.customer && p.customer.cpf),
    cidade: p.shipping ? (p.shipping.city + '/' + p.shipping.state) : '',
    dispositivo: ctx.device || '',
    origem: utm.source || ctx.source || '',
    meio: utm.medium || ctx.medium || '',
    campanha: utm.campaign || ctx.campaign || '',
    anuncio: utm.content || '',
    navegador: ctx.app || '',
    botao: ctx.cta || '',
    pixGeradoEm: p.createdAt,
    pixExpiraEm: p.pixExpiresAt || '',
    pagoEm: p.paidAt || '',
    transacao: p.transactionId || '',
    teste: !!p.testMode,
    whatsapp: telefone ? 'https://wa.me/55' + telefone : ''
  };
}

function contar(lista, chave) {
  const saida = {};
  lista.forEach((l) => {
    const k = l[chave] || '(sem informação)';
    if (!saida[k]) saida[k] = { pix_gerados: 0, pagos: 0 };
    saida[k].pix_gerados++;
    if (l.status === 'PAID') saida[k].pagos++;
  });
  return saida;
}

function csv(linhas) {
  if (!linhas.length) return '﻿sem pedidos\n';
  const colunas = Object.keys(linhas[0]);
  const celula = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return '﻿' + colunas.join(';') + '\n' + linhas.map((l) => colunas.map((c) => celula(l[c])).join(';')).join('\n') + '\n';
}

module.exports = async function handler(req, res) {
  if (!somenteMetodo(req, res, 'GET')) return;
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const url = new URL(req.url, 'https://local');
  const autorizado = tokenOk(req, url);
  if (autorizado === null) return json(res, 404, { ok: false });
  if (!autorizado) return json(res, 401, { ok: false, error: 'Não autorizado.' });

  const dias = Math.max(1, Math.min(Number(url.searchParams.get('dias')) || 30, 60));
  const limite = Math.max(1, Math.min(Number(url.searchParams.get('limite')) || 300, 1000));
  const filtroStatus = String(url.searchParams.get('status') || '')
    .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const desde = Date.now() - dias * 86400000;
  const agora = Date.now();

  let pedidos;
  try {
    pedidos = await store.listarPedidos(limite);
  } catch (e) {
    console.error('[orders] falha ao listar', e.message);
    return json(res, 500, { ok: false, error: 'Não foi possível ler os pedidos.' });
  }

  const linhas = pedidos
    .filter((p) => (Date.parse(p.createdAt) || 0) >= desde)
    .filter((p) => !filtroStatus.length || filtroStatus.indexOf(p.status) !== -1)
    .map((p) => resumir(p, agora));

  if (url.searchParams.get('formato') === 'csv') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pedidos-bodyman.csv"');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(csv(linhas));
  }

  const reais_ = linhas.filter((l) => !l.teste);
  const pagos = reais_.filter((l) => l.status === 'PAID').length;
  return json(res, 200, {
    ok: true,
    periodo: { dias, desde: new Date(desde).toISOString() },
    resumo: {
      pix_gerados: reais_.length,
      pagos,
      taxa_de_pagamento: reais_.length ? Math.round((pagos / reais_.length) * 1000) / 10 + '%' : '0%',
      por_situacao: reais_.reduce((t, l) => { t[l.situacao] = (t[l.situacao] || 0) + 1; return t; }, {}),
      por_dispositivo: contar(reais_, 'dispositivo'),
      por_origem: contar(reais_, 'origem'),
      por_campanha: contar(reais_, 'campanha'),
      por_plano: contar(reais_, 'plano')
    },
    pedidos: linhas
  });
};
