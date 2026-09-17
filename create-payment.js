/**
 * POST /api/create-payment
 *
 * Recebe apenas o plano, as fragrâncias escolhidas, os dados do cliente,
 * o endereço e as UTMs. O preço NUNCA vem do navegador: é lido de PLANS.
 */
const crypto = require('crypto');
const { json, erroAmigavel, lerCorpo, somenteMetodo, mascarar } = require('./_lib/http');
const {
  PLANS, PRODUCTS, PIX_EXPIRES_IN_DAYS, PAYMENTS_ENABLED, IS_PRODUCTION,
  ORDER_PREFIX, distribuirCentavos
} = require('./_lib/config');
const { validarPlano, validarCliente, validarEndereco, limparUTM } = require('./_lib/validate');
const store = require('./_lib/store');
const blackcat = require('./_lib/blackcat');

const WEBHOOK_URL = process.env.BLACKCAT_WEBHOOK_URL || 'https://idealstore.online/api/blackcat-webhook';

function gerarExternalRef() {
  const d = new Date();
  const data = d.getFullYear() +
    ('0' + (d.getMonth() + 1)).slice(-2) +
    ('0' + d.getDate()).slice(-2);
  const aleatorio = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return ORDER_PREFIX + '-' + data + '-' + aleatorio;
}

/** Itens tangíveis com os centavos distribuídos sem sobra nem falta. */
function montarItens(produtos, total) {
  const valores = distribuirCentavos(total, produtos.length);
  return produtos.map((slug, i) => ({
    title: PRODUCTS[slug].title,
    quantity: 1,
    tangible: true,
    unitPrice: valores[i]
  }));
}

module.exports = async function handler(req, res) {
  if (!somenteMetodo(req, res, 'POST')) return;

  const corpo = await lerCorpo(req);
  if (!corpo) return erroAmigavel(res, 400, 'Confira seus dados e tente novamente.', 'corpo inválido');

  // ---- 1. plano e fragrâncias (servidor decide) ----
  const plano = validarPlano(corpo.plan, corpo.selectedProducts);
  if (plano.erro) return erroAmigavel(res, 400, plano.erro);

  // ---- 2. cliente ----
  const cli = validarCliente(corpo.customer);
  if (cli.erro) return erroAmigavel(res, 400, cli.erro);

  // ---- 3. endereço (produto físico: obrigatório) ----
  const end = validarEndereco(corpo.shipping);
  if (end.erro) return erroAmigavel(res, 400, end.erro);

  const utm = limparUTM(corpo.utm);
  const config = PLANS[plano.plan];
  const amount = config.amount;                       // fonte oficial do preço
  const itens = montarItens(plano.produtos, amount);

  const somaItens = itens.reduce((t, i) => t + i.unitPrice * i.quantity, 0);
  if (somaItens !== amount) {
    return erroAmigavel(res, 500, 'Não conseguimos gerar o pagamento agora. Tente novamente em alguns instantes.',
      'soma dos itens (' + somaItens + ') diferente do total (' + amount + ')');
  }

  const externalRef = gerarExternalRef();
  const publicToken = crypto.randomUUID();

  const pedidoBase = {
    externalRef,
    publicToken,
    plan: plano.plan,
    products: plano.produtos,
    quantity: config.quantity,
    volumeMl: config.quantity * 200,
    amount,
    shippingAmount: 0,
    status: 'PENDING_PAYMENT',
    customer: cli.customer,
    shipping: end.shipping,
    utm,
    transactionId: null,
    createdAt: new Date().toISOString()
  };

  // ---- MODO DE TESTE: não chama a BlackCat ----
  if (!PAYMENTS_ENABLED) {
    if (IS_PRODUCTION) console.warn('[create-payment] ATENÇÃO: PAYMENTS_ENABLED=false em produção. Nenhuma cobrança real foi criada.');
    const fakeId = 'TESTE-' + externalRef;
    const pedido = Object.assign({}, pedidoBase, { transactionId: fakeId, testMode: true });
    await store.salvarPedido(pedido).catch((e) => console.error('[create-payment] falha ao salvar', e.message));
    return json(res, 200, {
      ok: true, testMode: true, externalRef, transactionId: fakeId, token: publicToken,
      amount, quantity: config.quantity, products: plano.produtos,
      pix: {
        copyPaste: '00020126MODO-DE-TESTE-NAO-PAGAR-' + externalRef,
        qrCodeBase64: null,
        expiresAt: new Date(Date.now() + PIX_EXPIRES_IN_DAYS * 86400000).toISOString()
      }
    });
  }

  if (!blackcat.temChave()) {
    return erroAmigavel(res, 503, 'Configuração de pagamento indisponível.', 'BLACKCAT_API_KEY ausente');
  }

  // ---- 4. venda na BlackCat ----
  const payload = {
    amount,
    currency: 'BRL',
    paymentMethod: 'pix',
    items: itens,
    customer: {
      name: cli.customer.name,
      email: cli.customer.email,
      phone: cli.customer.phone,
      document: { number: cli.customer.cpf, type: 'cpf' }
    },
    shipping: {
      name: cli.customer.name,
      street: end.shipping.street,
      number: end.shipping.number,
      complement: end.shipping.complement || '',
      neighborhood: end.shipping.neighborhood,
      city: end.shipping.city,
      state: end.shipping.state,
      zipCode: end.shipping.zipCode
    },
    pix: { expiresInDays: PIX_EXPIRES_IN_DAYS },
    postbackUrl: WEBHOOK_URL,
    externalRef,
    utm
  };

  let resposta;
  try {
    resposta = await blackcat.criarVenda(payload);
  } catch (e) {
    return erroAmigavel(res, 502, 'Não conseguimos gerar o pagamento agora. Tente novamente em alguns instantes.',
      'falha de rede com a BlackCat: ' + e.message);
  }

  if (!resposta.ok) {
    console.error('[create-payment] BlackCat respondeu', resposta.status, JSON.stringify(resposta.corpo));
    const mensagem = resposta.status === 401 || resposta.status === 403
      ? 'Configuração de pagamento indisponível.'
      : 'Não conseguimos gerar o pagamento agora. Tente novamente em alguns instantes.';
    return erroAmigavel(res, 502, mensagem);
  }

  const venda = blackcat.normalizarVenda(resposta.corpo);

  if (!venda.transactionId || (!venda.pix.copyPaste && !venda.pix.qrCodeBase64)) {
    console.error('[create-payment] resposta sem PIX utilizável:', JSON.stringify(resposta.corpo));
    return erroAmigavel(res, 502, 'Não conseguimos gerar o pagamento agora. Tente novamente em alguns instantes.');
  }

  const pedido = Object.assign({}, pedidoBase, {
    transactionId: venda.transactionId,
    status: venda.status || 'PENDING_PAYMENT',
    invoiceUrl: venda.invoiceUrl || null,
    pixExpiresAt: venda.pix.expiresAt || null
  });

  try {
    await store.salvarPedido(pedido);
  } catch (e) {
    // O PIX já existe: não dá para abortar a compra por falha de gravação.
    console.error('[create-payment] PIX criado mas pedido NÃO foi salvo:', externalRef, venda.transactionId, e.message);
  }

  console.log('[create-payment] pedido', externalRef, 'tx', venda.transactionId,
    'plano', plano.plan, 'valor', amount, 'cliente', mascarar(cli.customer.email, 4));

  return json(res, 200, {
    ok: true,
    externalRef,
    transactionId: venda.transactionId,
    token: publicToken,
    amount,
    quantity: config.quantity,
    products: plano.produtos,
    pix: {
      copyPaste: venda.pix.copyPaste,
      qrCodeBase64: venda.pix.qrCodeBase64,
      expiresAt: venda.pix.expiresAt
    }
  });
};
