/* =====================================================================
   BODYMAN — CHECKOUT PIX (BlackCat)

   Este arquivo cuida só da experiência de checkout. Nenhum preço daqui
   é usado para cobrar: o servidor recalcula tudo a partir do plano.
   A API Key da BlackCat não existe neste arquivo e nunca deve existir.

   Contrato com o servidor (não mudou):
     POST /api/create-payment  { plan, selectedProducts, customer, shipping, utm }
       -> { ok, amount, externalRef, transactionId, token, testMode,
            pix: { copyPaste, qrCode, qrCodeBase64, expiresAt } }
     GET  /api/payment-status?transactionId=...&token=...  -> { status }

   Passos: dados -> entrega -> pix -> confirmado
   ===================================================================== */
(function () {
  'use strict';

  var API_CRIAR = '/api/create-payment';
  var API_STATUS = '/api/payment-status';

  var PRODUTOS = {
    enigma: 'Bodyman Enigma',
    midtown: 'Bodyman Midtown',
    barbarius: 'Bodyman Barbarius'
  };
  var NOME_PLANO = {
    triple: 'Kit Bodyman com 3 fragrâncias',
    double: '2 frascos Bodyman',
    single: '1 frasco Bodyman'
  };

  var POLL_PRIMEIRO = 5000;      // primeira consulta
  var POLL_INTERVALO = 6000;     // depois
  var POLL_LIMITE = 30 * 60000;  // para de consultar sozinho 30 min após gerar o PIX
  var VALIDADE_PADRAO = 24 * 3600000;  // sem data de expiração do PIX, guarda por 24 h

  var CHAVE_PENDENTE = 'bm_pix_pendente';
  var CHAVE_ULTIMO = 'bm_ultimo_pedido';

  var estado = {
    aberto: false,
    passo: 'dados',
    pedido: null,          // seleção vinda da landing page
    resposta: null,        // resposta do /api/create-payment
    criadoEm: 0,
    enviando: false,
    poll: null,
    pollInicio: 0,
    copiado: false,
    dados: { name: '', email: '', phone: '', cpf: '' },
    endereco: { zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
  };

  /* ---------------- utilidades ---------------- */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var digitos = function (v) { return String(v || '').replace(/\D/g, ''); };
  var brl = function (centavos) { return 'R$ ' + (centavos / 100).toFixed(2).replace('.', ','); };
  var escapar = function (t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  function assign(alvo) {
    for (var i = 1; i < arguments.length; i++) {
      var o = arguments[i];
      if (o) for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) alvo[k] = o[k];
    }
    return alvo;
  }
  function lerLocal(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { return null; }
  }
  function gravarLocal(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) {}
  }
  function apagarLocal(chave) {
    try { localStorage.removeItem(chave); } catch (e) {}
  }
  function linkWhats(msg) {
    if (window.BM_SITE && window.BM_SITE.linkWhats) return window.BM_SITE.linkWhats(msg);
    return 'https://wa.me/5516995417328?text=' + encodeURIComponent(msg);
  }
  function telaPequena() { return window.innerWidth < 768; }

  function guardar() {
    try {
      sessionStorage.setItem('bm_checkout', JSON.stringify({ dados: estado.dados, endereco: estado.endereco }));
    } catch (e) {}
  }
  function recuperar() {
    try {
      var s = JSON.parse(sessionStorage.getItem('bm_checkout') || '{}');
      if (s.dados) estado.dados = assign(estado.dados, s.dados);
      if (s.endereco) estado.endereco = assign(estado.endereco, s.endereco);
    } catch (e) {}
  }

  /* ---------------- UTMs (o site.js também captura; aqui é reserva) ---------------- */
  function capturarUTM() {
    var campos = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var atual = {};
    try { atual = JSON.parse(sessionStorage.getItem('bm_utm') || '{}'); } catch (e) {}
    var mudou = false;
    try {
      var params = new URLSearchParams(location.search);
      campos.forEach(function (c) {
        var v = params.get(c);
        if (v) { atual[c.replace('utm_', '')] = v.slice(0, 120); mudou = true; }
      });
    } catch (e) {}
    if (mudou) { try { sessionStorage.setItem('bm_utm', JSON.stringify(atual)); } catch (e) {} }
  }
  function utmAtual() {
    try { return JSON.parse(sessionStorage.getItem('bm_utm') || '{}'); } catch (e) { return {}; }
  }

  /* ---------------- eventos do funil ----------------
     Vão pelo BM_FUNIL (site.js). Se ele não carregar, uma versão mínima
     mantém dataLayer e Meta Pixel funcionando.
     purchase só existe aqui porque só é disparado com pagamento confirmado. */
  var META_RESERVA = {
    begin_checkout: ['track', 'InitiateCheckout'],
    add_shipping_info: ['trackCustom', 'AddShippingInfo'],
    pix_generated: ['track', 'AddPaymentInfo'],
    purchase: ['track', 'Purchase']
  };
  var unicosReserva = {};

  function evento(nome, dados, opcoes) {
    if (window.BM_FUNIL && window.BM_FUNIL.evento) return window.BM_FUNIL.evento(nome, dados, opcoes);
    if (opcoes && opcoes.unico) {
      if (unicosReserva[opcoes.unico]) return false;
      unicosReserva[opcoes.unico] = true;
    }
    var payload = assign({ event: nome }, dados || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    var m = META_RESERVA[nome];
    if (m && typeof window.fbq === 'function') {
      var props = { currency: 'BRL', content_type: 'product' };
      if (payload.value != null) props.value = payload.value;
      if (payload.products) props.content_ids = payload.products;
      if (payload.plan) props.content_name = payload.plan;
      try {
        if (payload.externalRef) window.fbq(m[0], m[1], props, { eventID: payload.externalRef });
        else window.fbq(m[0], m[1], props);
      } catch (e) {}
    }
    return true;
  }

  /* ---------------- máscaras ---------------- */
  function mascaraCPF(v) {
    var d = digitos(v).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  function mascaraTelefone(v) {
    var d = digitos(v).slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  }
  function mascaraCEP(v) {
    return digitos(v).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  }

  /* ---------------- validação (espelho da do servidor) ---------------- */
  function cpfOk(cpf) {
    var d = digitos(cpf);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var soma = 0;
      for (var i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
      var dv = (soma * 10) % 11;
      if (dv === 10) dv = 0;
      if (dv !== Number(d[t])) return false;
    }
    return true;
  }
  function telefoneOk(tel) {
    var d = digitos(tel);
    if (d.length !== 10 && d.length !== 11) return false;
    if (Number(d.slice(0, 2)) < 11) return false;
    return d.length === 10 || d[2] === '9';
  }
  var emailOk = function (e) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e || '').trim()); };
  var nomeOk = function (n) {
    var p = String(n || '').trim().split(/\s+/).filter(function (x) { return x.length >= 2; });
    return p.length >= 2;
  };

  /* ---------------- ícones ---------------- */
  var ICO = {
    cadeado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    conversa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    copiar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  /* ---------------- markup ---------------- */
  var overlay = null;

  function criarOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'bm-co';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'bm-co-titulo');
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="bm-co-fundo" data-fechar></div>' +
      '<div class="bm-co-painel" tabindex="-1">' +
        '<header class="bm-co-topo">' +
          '<ol class="bm-co-passos" id="bm-co-passos" aria-label="Etapas da compra"></ol>' +
          '<button type="button" class="bm-co-x" data-fechar aria-label="Fechar">&times;</button>' +
        '</header>' +
        '<div class="bm-co-corpo" id="bm-co-corpo"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-fechar]')) fechar();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && estado.aberto) fechar();
    });
  }

  function trilha() {
    var passos = [
      { id: 'dados', rotulo: 'Dados' },
      { id: 'entrega', rotulo: 'Entrega' },
      { id: 'pix', rotulo: 'Pagamento' }
    ];
    var atual = estado.passo === 'confirmado' ? 3 : passos.map(function (p) { return p.id; }).indexOf(estado.passo);
    $('#bm-co-passos').innerHTML = passos.map(function (p, i) {
      var cls = i < atual ? 'feito' : (i === atual ? 'ativo' : '');
      return '<li class="bm-co-passo ' + cls + '"' + (i === atual ? ' aria-current="step"' : '') + '>' +
        '<span class="bm-co-passo-n">' + (i < atual ? '✓' : i + 1) + '</span>' + p.rotulo + '</li>';
    }).join('');
  }

  function campo(id, rotulo, opcoes) {
    var o = opcoes || {};
    return '<label class="bm-co-campo' + (o.largura ? ' bm-co-campo--' + o.largura : '') + '">' +
      '<span>' + rotulo + '</span>' +
      '<input id="' + id + '" type="' + (o.tipo || 'text') + '"' +
        (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') +
        (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '') +
        (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') +
        (o.placeholder ? ' placeholder="' + o.placeholder + '"' : '') +
        (o.capitalizar ? ' autocapitalize="words"' : '') +
        ' value="' + escapar(o.valor || '') + '">' +
      (o.ajuda ? '<small class="bm-co-ajuda">' + o.ajuda + '</small>' : '') +
      '<em class="bm-co-erro" data-erro-de="' + id + '"></em>' +
    '</label>';
  }

  function listaSabores(produtos) {
    var nomes = produtos.map(function (s) { return (PRODUTOS[s] || s).replace('Bodyman ', ''); });
    if (nomes.length < 2) return nomes.join('');
    return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  }

  function resumoItens() {
    return estado.pedido.produtos.map(function (s) {
      return '<li><span>1x ' + escapar(PRODUTOS[s] || s) + '</span><span>200 ml</span></li>';
    }).join('');
  }

  function blocoResumo(alteravel) {
    var p = estado.pedido;
    var n = p.produtos.length;
    return '<div class="bm-co-resumo">' +
      '<div class="bm-co-resumo-topo">' +
        '<p class="bm-co-resumo-tit">Resumo do pedido</p>' +
        (alteravel ? '<button type="button" class="bm-link" data-co-alterar>Alterar</button>' : '') +
      '</div>' +
      '<p class="bm-co-resumo-nome">' + escapar(NOME_PLANO[p.plan] || 'Seu pedido') + '</p>' +
      '<p class="bm-co-resumo-sub">' + escapar(listaSabores(p.produtos)) + ' · ' + n + (n > 1 ? ' frascos' : ' frasco') + ' de 200 ml' + (n > 1 ? ' (' + n * 200 + ' ml)' : '') + '</p>' +
      '<dl class="bm-co-linhas">' +
        '<div><dt>Quantidade</dt><dd>' + n + (n > 1 ? ' produtos' : ' produto') + '</dd></div>' +
        '<div><dt>Frete</dt><dd class="bm-co-gratis">Grátis</dd></div>' +
        '<div class="bm-co-linha-total"><dt>Total</dt><dd>' + brl(p.total) + '</dd></div>' +
      '</dl>' +
    '</div>';
  }

  function blocoConfianca() {
    return '<ul class="bm-co-confianca">' +
      '<li>' + ICO.cadeado + 'Pagamento seguro via PIX</li>' +
      '<li>' + ICO.escudo + 'Pedido protegido: 7 dias para desistir</li>' +
      '<li>' + ICO.conversa + 'Atendimento disponível no WhatsApp</li>' +
    '</ul>';
  }

  /* ---------------- telas ---------------- */
  function telaDados() {
    var d = estado.dados;
    return blocoResumo(true) + blocoConfianca() +
      '<h2 class="bm-co-titulo" id="bm-co-titulo">Seus dados</h2>' +
      '<p class="bm-co-sub">Para emitir o pedido e enviar o código de rastreio.</p>' +
      '<div class="bm-co-grid">' +
        campo('bm-nome', 'Nome completo', { valor: d.name, autocomplete: 'name', placeholder: 'Nome e sobrenome', capitalizar: true }) +
        campo('bm-email', 'E-mail', { valor: d.email, tipo: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'voce@email.com' }) +
        campo('bm-tel', 'WhatsApp com DDD', { valor: d.phone, tipo: 'tel', inputmode: 'tel', autocomplete: 'tel-national', placeholder: '(00) 00000-0000', maxlength: 15, largura: 'metade' }) +
        campo('bm-cpf', 'CPF', { valor: d.cpf, inputmode: 'numeric', placeholder: '000.000.000-00', maxlength: 14, largura: 'metade', ajuda: 'Obrigatório para gerar o PIX.' }) +
      '</div>' +
      '<button type="button" class="bm-btn bm-btn--lg" id="bm-co-avancar">Continuar para a entrega</button>';
  }

  function telaEntrega() {
    var e = estado.endereco, p = estado.pedido;
    return '<h2 class="bm-co-titulo" id="bm-co-titulo">Endereço de entrega</h2>' +
      '<p class="bm-co-sub">Frete grátis para todo o Brasil. Digite o CEP que preenchemos o resto.</p>' +
      '<div class="bm-co-grid">' +
        campo('bm-cep', 'CEP', { valor: mascaraCEP(e.zipCode), inputmode: 'numeric', autocomplete: 'postal-code', placeholder: '00000-000', maxlength: 9, largura: 'metade' }) +
        '<span class="bm-co-cepstatus" id="bm-co-cepstatus" aria-live="polite"></span>' +
        campo('bm-rua', 'Rua / logradouro', { valor: e.street, autocomplete: 'address-line1' }) +
        campo('bm-num', 'Número', { valor: e.number, placeholder: 'Ex.: 123 ou S/N', largura: 'metade' }) +
        campo('bm-compl', 'Complemento (opcional)', { valor: e.complement, autocomplete: 'address-line2', largura: 'metade' }) +
        campo('bm-bairro', 'Bairro', { valor: e.neighborhood, autocomplete: 'address-level3' }) +
        campo('bm-cidade', 'Cidade', { valor: e.city, autocomplete: 'address-level2', largura: 'metade' }) +
        campo('bm-uf', 'UF', { valor: e.state, autocomplete: 'address-level1', maxlength: 2, largura: 'metade', placeholder: 'SP' }) +
      '</div>' +
      '<div class="bm-co-total">' +
        '<span>' + escapar(NOME_PLANO[p.plan] || 'Pedido') + ' · frete grátis</span>' +
        '<strong>' + brl(p.total) + '</strong>' +
      '</div>' +
      '<p class="bm-co-msg" id="bm-co-msg" role="alert"></p>' +
      '<div class="bm-co-acoes">' +
        '<button type="button" class="bm-btn bm-btn--ghost" id="bm-co-voltar">Voltar</button>' +
        '<button type="button" class="bm-btn bm-btn--lg" id="bm-co-pix">Gerar PIX — ' + brl(p.total) + '</button>' +
      '</div>' +
      '<p class="bm-co-nota">' + ICO.cadeado + 'Seus dados são usados só para este pedido.</p>';
  }

  function validadeTexto(r) {
    var exp = r && r.pix && r.pix.expiresAt;
    if (!exp) return '';
    var d = new Date(exp);
    if (isNaN(d.getTime()) || d.getTime() < Date.now()) return '';
    try {
      return 'Código válido até ' + d.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      }).replace(',', ' às') + '.';
    } catch (e) { return ''; }
  }

  function telaPix() {
    var r = estado.resposta;
    r.pix = r.pix || {};
    var ajuda = 'Olá! Gerei o PIX do pedido ' + (r.externalRef || '') + ' no site da Bodyman e preciso de ajuda.';
    var validade = validadeTexto(r);
    var codigo = r.pix.copyPaste || r.pix.qrCode || '';
    if (!codigo) {
      return '<h2 class="bm-co-titulo" id="bm-co-titulo">Seu pedido foi reservado.</h2>' +
        '<p class="bm-co-sub">Não recebemos o código PIX do processador de pagamentos. Fale com a gente para concluir a compra.</p>' +
        '<a class="bm-btn bm-btn--lg" href="' + escapar(linkWhats(ajuda)) + '" target="_blank" rel="noopener">Falar no WhatsApp</a>' +
        '<p class="bm-co-ref">Pedido ' + escapar(r.externalRef || '') + '</p>';
    }
    return (r.testMode ? '<p class="bm-co-teste">Modo de teste — cobrança não criada.</p>' : '') +
      '<div class="bm-co-pix-topo">' +
        '<p class="bm-co-sobre">Pagamento via PIX</p>' +
        '<h2 class="bm-co-titulo" id="bm-co-titulo">Seu pedido foi reservado.</h2>' +
        '<p class="bm-co-sub">Finalize o pagamento para confirmar sua compra.</p>' +
        '<p class="bm-co-valor">' + brl(r.amount) + '</p>' +
      '</div>' +
      '<button type="button" class="bm-btn bm-btn--lg bm-btn--copiar" id="bm-co-copiar">' + ICO.copiar + '<span>Copiar código PIX</span></button>' +
      '<p class="bm-co-copiado" id="bm-co-copiado" role="status" aria-live="polite"></p>' +
      '<ol class="bm-co-como" aria-label="Como pagar">' +
        '<li><span>Toque em <b>Copiar código PIX</b></span></li>' +
        '<li><span>Abra o aplicativo do seu banco</span></li>' +
        '<li><span>Vá até a área <b>PIX</b></span></li>' +
        '<li><span>Escolha <b>PIX Copia e Cola</b></span></li>' +
        '<li><span>Cole o código</span></li>' +
        '<li><span>Confirme o pagamento</span></li>' +
      '</ol>' +
      '<div class="bm-co-codigo" id="bm-co-codigo" aria-label="Código PIX copia e cola">' + escapar(codigo) + '</div>' +
      '<div class="bm-co-status" id="bm-co-status">' +
        '<p class="bm-co-aguardando" id="bm-co-aguardando"><span class="bm-co-pulso" aria-hidden="true"></span>Aguardando pagamento…</p>' +
        '<p class="bm-co-sub">Após o pagamento, aguarde alguns segundos. A confirmação acontece automaticamente.</p>' +
        '<button type="button" class="bm-link" id="bm-co-verificar">Já paguei — verificar agora</button>' +
      '</div>' +
      (validade ? '<p class="bm-co-validade">' + validade + '</p>' : '') +
      '<details class="bm-co-qr-box" id="bm-co-qr-box"' + (telaPequena() ? '' : ' open') + '>' +
        '<summary>Pagar com QR Code' + (telaPequena() ? ' (em outro aparelho)' : '') + '</summary>' +
        '<div class="bm-co-qr" id="bm-co-qr-canvas"></div>' +
      '</details>' +
      '<a class="bm-btn bm-btn--ghost bm-btn--lg" href="' + escapar(linkWhats(ajuda)) + '" target="_blank" rel="noopener" data-co-ajuda>Precisa de ajuda?</a>' +
      '<p class="bm-co-ref">Pedido ' + escapar(r.externalRef || '') + '</p>';
  }

  function textoPostagem() {
    try {
      if (window.BODYMAN && window.BODYMAN.textoEnvioPedido) return window.BODYMAN.textoEnvioPedido();
    } catch (e) {}
    return 'Pedidos com pagamento confirmado até as 12h em dias úteis são postados no mesmo dia.';
  }

  function telaConfirmado() {
    var r = estado.resposta, e = estado.endereco;
    var temEndereco = e && e.street && e.city;
    var ajuda = 'Olá! Paguei o pedido ' + (r.externalRef || '') + ' no site da Bodyman e quero acompanhar meu pedido.';
    return '<div class="bm-co-ok">' +
      '<div class="bm-co-selo" aria-hidden="true">' + ICO.ok + '</div>' +
      '<h2 class="bm-co-titulo" id="bm-co-titulo">Pagamento confirmado</h2>' +
      '<p class="bm-co-sub">Pedido recebido com sucesso! Já estamos preparando seu pedido para envio.</p>' +
      '<p class="bm-co-ref">Número do pedido<br><strong>' + escapar(r.externalRef || '') + '</strong></p>' +
      '<ul class="bm-co-itens">' + resumoItens() + '</ul>' +
      (temEndereco ? '<p class="bm-co-entrega">Entrega em: ' + escapar(e.street) + ', ' + escapar(e.number) + ' · ' +
        escapar(e.city) + '/' + escapar(e.state) + ' · ' + mascaraCEP(e.zipCode) + '</p>' : '') +
      '<div class="bm-co-depois">' +
        '<p class="bm-co-depois-tit">Comprou? Agora é simples.</p>' +
        '<ol class="bm-co-fluxo">' +
          '<li class="feito">Pagamento aprovado</li>' +
          '<li>Pedido preparado</li>' +
          '<li>Pedido enviado</li>' +
          '<li>Rastreamento disponibilizado</li>' +
          '<li>Produto entregue</li>' +
        '</ol>' +
        '<p class="bm-co-envio">' + escapar(textoPostagem()) + '</p>' +
      '</div>' +
      '<div class="bm-co-acoes bm-co-acoes--coluna">' +
        '<button type="button" class="bm-btn bm-btn--lg" data-fechar>Fechar</button>' +
        '<a class="bm-btn bm-btn--ghost" href="' + escapar(linkWhats(ajuda)) + '" target="_blank" rel="noopener">Falar com o atendimento</a>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- render ---------------- */
  function render() {
    var corpo = $('#bm-co-corpo');
    if (estado.passo === 'dados') corpo.innerHTML = telaDados();
    else if (estado.passo === 'entrega') corpo.innerHTML = telaEntrega();
    else if (estado.passo === 'pix') corpo.innerHTML = telaPix();
    else corpo.innerHTML = telaConfirmado();

    trilha();
    corpo.scrollTop = 0;
    ligarEventos();
    evento('checkout_step', { step: estado.passo, plan: estado.pedido && estado.pedido.plan });
  }

  function mostrarErro(id, mensagem) {
    var el = overlay.querySelector('[data-erro-de="' + id + '"]');
    if (el) el.textContent = mensagem || '';
    var input = document.getElementById(id);
    if (input) {
      input.classList.toggle('erro', Boolean(mensagem));
      if (mensagem) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }

  function limparErros() {
    Array.prototype.forEach.call(overlay.querySelectorAll('.bm-co-erro'), function (e) { e.textContent = ''; });
    Array.prototype.forEach.call(overlay.querySelectorAll('input.erro'), function (e) {
      e.classList.remove('erro');
      e.removeAttribute('aria-invalid');
    });
  }

  function focarPrimeiroErro() {
    var el = overlay.querySelector('input.erro');
    if (el) { el.focus(); try { el.scrollIntoView({ block: 'center' }); } catch (e) {} }
  }

  /* ---------------- ligações de cada tela ---------------- */
  function ligarEventos() {
    var voltar = $('#bm-co-voltar');
    if (voltar) voltar.addEventListener('click', function () {
      estado.passo = 'dados';
      render();
    });
    var alterar = overlay.querySelector('[data-co-alterar]');
    if (alterar) alterar.addEventListener('click', function () {
      fechar();
      if (window.BODYMAN && window.BODYMAN.irParaSeletor) window.BODYMAN.irParaSeletor();
    });

    if (estado.passo === 'dados') ligarDados();
    if (estado.passo === 'entrega') ligarEntrega();
    if (estado.passo === 'pix') ligarPix();
  }

  function ligarDados() {
    var tel = $('#bm-tel'), cpf = $('#bm-cpf');
    tel.addEventListener('input', function () { tel.value = mascaraTelefone(tel.value); });
    cpf.addEventListener('input', function () { cpf.value = mascaraCPF(cpf.value); });

    $('#bm-co-avancar').addEventListener('click', function () {
      limparErros();
      var d = {
        name: $('#bm-nome').value.trim().replace(/\s+/g, ' '),
        email: $('#bm-email').value.trim(),
        phone: $('#bm-tel').value,
        cpf: $('#bm-cpf').value
      };
      var ok = true;
      if (!nomeOk(d.name)) { mostrarErro('bm-nome', 'Informe nome e sobrenome.'); ok = false; }
      if (!emailOk(d.email)) { mostrarErro('bm-email', 'E-mail inválido. Confira se digitou certinho.'); ok = false; }
      if (!telefoneOk(d.phone)) { mostrarErro('bm-tel', 'Telefone inválido. Use DDD + número.'); ok = false; }
      if (!cpfOk(d.cpf)) { mostrarErro('bm-cpf', 'CPF inválido. Confira os números.'); ok = false; }
      if (!ok) { focarPrimeiroErro(); return; }

      estado.dados = d;
      guardar();
      evento('add_contact_info', { plan: estado.pedido.plan }, { unico: 'add_contact_info' });
      estado.passo = 'entrega';
      render();
    });
  }

  function lerEndereco() {
    return {
      zipCode: digitos($('#bm-cep').value),
      street: $('#bm-rua').value.trim(),
      number: $('#bm-num').value.trim(),
      complement: $('#bm-compl').value.trim(),
      neighborhood: $('#bm-bairro').value.trim(),
      city: $('#bm-cidade').value.trim(),
      state: $('#bm-uf').value.trim().toUpperCase()
    };
  }

  function ligarEntrega() {
    var cep = $('#bm-cep');
    cep.addEventListener('input', function () {
      cep.value = mascaraCEP(cep.value);
      if (digitos(cep.value).length === 8) buscarCEP(digitos(cep.value));
    });
    $('#bm-uf').addEventListener('input', function (e) {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    });
    /* guarda o que já foi digitado, para não perder ao voltar */
    Array.prototype.forEach.call(overlay.querySelectorAll('.bm-co-grid input'), function (i) {
      i.addEventListener('change', function () { estado.endereco = lerEndereco(); guardar(); });
    });
    $('#bm-co-pix').addEventListener('click', function () {
      limparErros();
      var e = lerEndereco();
      var ok = true;
      if (e.zipCode.length !== 8) { mostrarErro('bm-cep', 'CEP deve ter 8 números.'); ok = false; }
      if (e.street.length < 3) { mostrarErro('bm-rua', 'Informe a rua.'); ok = false; }
      if (!e.number) { mostrarErro('bm-num', 'Informe o número (ou S/N).'); ok = false; }
      if (e.neighborhood.length < 2) { mostrarErro('bm-bairro', 'Informe o bairro.'); ok = false; }
      if (e.city.length < 2) { mostrarErro('bm-cidade', 'Informe a cidade.'); ok = false; }
      if (e.state.length !== 2) { mostrarErro('bm-uf', 'UF inválida.'); ok = false; }
      if (!ok) { focarPrimeiroErro(); return; }

      estado.endereco = e;
      guardar();
      evento('add_shipping_info', { plan: estado.pedido.plan }, { unico: 'add_shipping_info' });
      gerarPix();
    });
  }

  /* Busca de CEP: conveniência. Se falhar, o cliente digita e a compra segue. */
  function buscarCEP(cep) {
    var status = $('#bm-co-cepstatus');
    if (status) status.textContent = 'Buscando endereço…';
    fetch('https://viacep.com.br/ws/' + cep + '/json/')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!$('#bm-rua')) return;                     // o cliente já saiu da tela
        if (!d || d.erro) { if (status) status.textContent = 'CEP não encontrado. Preencha manualmente.'; return; }
        if (d.logradouro && !$('#bm-rua').value) $('#bm-rua').value = d.logradouro;
        if (d.bairro && !$('#bm-bairro').value) $('#bm-bairro').value = d.bairro;
        if (d.localidade) $('#bm-cidade').value = d.localidade;
        if (d.uf) $('#bm-uf').value = d.uf;
        if (status) status.textContent = 'Endereço preenchido. Confira e informe o número.';
        var num = $('#bm-num');
        if (num && !num.value) num.focus();
      })
      .catch(function () { if (status) status.textContent = 'Não deu para buscar o CEP. Preencha manualmente.'; });
  }

  /* ---------------- geração do PIX ---------------- */
  function gerarPix() {
    if (estado.enviando) return;                  // trava contra clique duplo
    estado.enviando = true;

    var botao = $('#bm-co-pix');
    var msg = $('#bm-co-msg');
    botao.disabled = true;
    botao.textContent = 'Gerando PIX…';
    if (msg) msg.textContent = '';
    var demora = setTimeout(function () {
      if (msg && estado.enviando) msg.textContent = 'Só mais um instante, estamos gerando seu código…';
    }, 9000);

    evento('pix_requested', { plan: estado.pedido.plan, value: estado.pedido.total / 100 });

    fetch(API_CRIAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: estado.pedido.plan,
        selectedProducts: estado.pedido.produtos,
        customer: {
          name: estado.dados.name,
          email: estado.dados.email,
          phone: digitos(estado.dados.phone),
          cpf: digitos(estado.dados.cpf)
        },
        shipping: estado.endereco,
        utm: utmAtual()
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, corpo: j }; }); })
      .then(function (r) {
        if (!r.ok || !r.corpo || !r.corpo.ok) throw new Error(r.corpo && r.corpo.error ? r.corpo.error : 'falha');
        r.corpo.pix = r.corpo.pix || {};
        estado.resposta = r.corpo;
        estado.criadoEm = Date.now();
        estado.copiado = false;
        salvarPendente();
        evento('pix_generated', {
          plan: estado.pedido.plan,
          products: estado.pedido.produtos,
          value: r.corpo.amount / 100,
          externalRef: r.corpo.externalRef
        });
        estado.passo = 'pix';
        render();
      })
      .catch(function (e) {
        var texto = e && e.message && e.message !== 'falha' && !/fetch|network|json|token/i.test(e.message)
          ? e.message
          : 'Não conseguimos gerar o pagamento agora. Tente novamente em alguns instantes.';
        evento('pix_error', { plan: estado.pedido.plan, error: String(e && e.message || 'falha').slice(0, 120) });
        if (msg) {
          msg.innerHTML = escapar(texto) + ' Se continuar, <a href="' +
            escapar(linkWhats('Olá! Estou tentando gerar o PIX no site da Bodyman e não consegui.')) +
            '" target="_blank" rel="noopener">fale com a gente no WhatsApp</a>.';
        }
        botao.disabled = false;
        botao.textContent = 'Gerar PIX — ' + brl(estado.pedido.total);
      })
      .then(function () { clearTimeout(demora); estado.enviando = false; });
  }

  /* ---------------- tela do PIX ---------------- */
  function ligarPix() {
    var r = estado.resposta;
    var botao = $('#bm-co-copiar');
    var aviso = $('#bm-co-copiado');
    var codigoEl = $('#bm-co-codigo');
    if (!botao) { if (!estado.poll) iniciarPolling(estado.criadoEm || Date.now()); return; }

    botao.addEventListener('click', function () {
      var codigo = r.pix.copyPaste || r.pix.qrCode || '';
      copiar(codigo).then(function (ok) {
        if (ok) {
          estado.copiado = true;
          botao.classList.add('bm-btn--copiado');
          botao.innerHTML = ICO.ok + '<span>Código PIX copiado!</span>';
          aviso.textContent = 'Agora abra o app do seu banco, escolha PIX Copia e Cola e cole o código.';
          evento('pix_copied', { plan: estado.pedido.plan, externalRef: r.externalRef }, { unico: 'pix_copied_' + r.externalRef });
          setTimeout(function () {
            if (!document.body.contains(botao)) return;
            botao.classList.remove('bm-btn--copiado');
            botao.innerHTML = ICO.copiar + '<span>Copiar código PIX novamente</span>';
          }, 4000);
        } else {
          selecionarTexto(codigoEl);
          aviso.textContent = 'Não foi possível copiar automaticamente. O código abaixo já está selecionado: toque e segure para copiar.';
        }
      });
    });

    $('#bm-co-verificar').addEventListener('click', function () {
      var b = this;
      b.disabled = true;
      b.textContent = 'Verificando…';
      consultarStatus().then(function (parar) {
        if (!document.body.contains(b)) return;
        b.disabled = false;
        b.textContent = 'Já paguei — verificar agora';
        if (!parar) {
          var el = $('#bm-co-aguardando');
          if (el) el.innerHTML = '<span class="bm-co-pulso" aria-hidden="true"></span>Ainda não recebemos a confirmação do banco. Seguimos verificando…';
          if (!estado.poll) iniciarPolling(Date.now());
        }
      });
    });

    var box = $('#bm-co-qr-box');
    if (box && box.open) montarQR(r);
    else if (box) box.addEventListener('toggle', function () { if (box.open) montarQR(r); });

    if (!estado.poll) iniciarPolling(estado.criadoEm || Date.now());
  }

  function selecionarTexto(el) {
    if (!el) return;
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
  }

  /* Resolve true/false: só mostra "copiado" quando a cópia realmente funcionou. */
  function copiar(texto) {
    return new Promise(function (resolve) {
      if (!texto) { resolve(false); return; }
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext !== false) {
        navigator.clipboard.writeText(texto).then(function () { resolve(true); }, function () { resolve(copiaAntiga(texto)); });
      } else {
        resolve(copiaAntiga(texto));
      }
    });
  }
  function copiaAntiga(texto) {
    var a = document.createElement('textarea');
    a.value = texto;
    a.setAttribute('readonly', '');
    a.style.position = 'fixed';
    a.style.top = '0';
    a.style.left = '0';
    a.style.opacity = '0';
    a.style.fontSize = '16px';                      // evita zoom no iOS
    (overlay || document.body).appendChild(a);
    var ok = false;
    try {
      a.focus();
      a.select();
      a.setSelectionRange(0, texto.length);         // iOS
      ok = document.execCommand('copy');
    } catch (e) { ok = false; }
    a.parentNode.removeChild(a);
    return Boolean(ok);
  }

  /**
   * A imagem do QR pode chegar em formatos diferentes: data URI completo,
   * URL de imagem ou base64 puro. Se não for nenhum desses (por exemplo
   * quando vem o próprio payload EMV), devolve null e desenhamos localmente.
   */
  function fonteImagemQR(valor) {
    if (!valor) return null;
    var v = String(valor).trim();
    if (v.indexOf('data:image') === 0) return v;
    if (/^https?:\/\//i.test(v)) return v;
    var limpo = v.replace(/\s/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(limpo) && limpo.length > 100) return 'data:image/png;base64,' + limpo;
    return null;
  }

  /** Tenta a imagem da BlackCat; qualquer falha cai no desenho local. */
  function montarQR(r) {
    var alvo = $('#bm-co-qr-canvas');
    if (!alvo || alvo.getAttribute('data-pronto')) return;
    alvo.setAttribute('data-pronto', '1');
    var codigo = r.pix.copyPaste || r.pix.qrCode || '';
    var src = fonteImagemQR(r.pix.qrCodeBase64);

    if (!src) { desenharQR(codigo); return; }

    var img = new Image();
    img.alt = 'QR Code do PIX';
    img.onerror = function () { desenharQR(codigo); };
    img.onload = function () { alvo.innerHTML = ''; alvo.appendChild(img); };
    img.src = src;
  }

  /* QR desenhado localmente quando a BlackCat não manda uma imagem utilizável.
     O código continua sendo exatamente o recebido dela. */
  function desenharQR(codigo) {
    var alvo = $('#bm-co-qr-canvas');
    if (!alvo || !codigo) return;
    function renderizar() {
      try {
        var canvas = document.createElement('canvas');
        alvo.innerHTML = '';
        alvo.appendChild(canvas);
        new window.QRious({ element: canvas, value: codigo, size: 460, level: 'M', background: '#ffffff', foreground: '#000000' });
      } catch (e) {
        alvo.innerHTML = '<p class="bm-co-sub">Use o código copia e cola acima.</p>';
      }
    }
    if (window.QRious) return renderizar();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
    s.onload = renderizar;
    s.onerror = function () { alvo.innerHTML = '<p class="bm-co-sub">Use o código copia e cola acima.</p>'; };
    document.head.appendChild(s);
  }

  /* ---------------- PIX pendente: sobrevive a recarregar a página ----------------
     No celular é comum o navegador do Instagram/Facebook recarregar a página
     enquanto o cliente está no app do banco. Guardamos só o necessário para
     reabrir o código e consultar o status (nada de dados pessoais). */
  function salvarPendente() {
    var r = estado.resposta;
    if (!r || !r.transactionId || !r.token) return;
    gravarLocal(CHAVE_PENDENTE, {
      v: 1,
      criadoEm: estado.criadoEm || Date.now(),
      pedido: {
        plan: estado.pedido.plan, produtos: estado.pedido.produtos,
        frascos: estado.pedido.frascos, total: estado.pedido.total, completo: true
      },
      resposta: {
        externalRef: r.externalRef, transactionId: r.transactionId, token: r.token,
        amount: r.amount, testMode: Boolean(r.testMode),
        pix: {
          copyPaste: r.pix.copyPaste || null, qrCode: r.pix.qrCode || null,
          qrCodeBase64: r.pix.qrCodeBase64 || null, expiresAt: r.pix.expiresAt || null
        }
      }
    });
  }

  function lerPendente() {
    var p = lerLocal(CHAVE_PENDENTE);
    if (!p || !p.resposta || !p.resposta.transactionId || !p.resposta.token || !p.pedido) return null;
    var exp = p.resposta.pix && p.resposta.pix.expiresAt ? new Date(p.resposta.pix.expiresAt).getTime() : NaN;
    var vencido = !isNaN(exp) ? Date.now() > exp : Date.now() - (p.criadoEm || 0) > VALIDADE_PADRAO;
    if (vencido || compraRegistrada(p.resposta.externalRef)) { apagarLocal(CHAVE_PENDENTE); return null; }
    return p;
  }

  function limparPendente() {
    apagarLocal(CHAVE_PENDENTE);
    removerBanner();
  }

  function compraRegistrada(ref) {
    if (!ref) return false;
    try { return localStorage.getItem('bm_compra_' + ref) === '1'; } catch (e) { return false; }
  }

  var banner = null;
  function mostrarBanner() {
    if (banner || estado.aberto || !estado.resposta) return;
    var r = estado.resposta;
    banner = document.createElement('div');
    banner.className = 'bm-pix-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<p><b>Você tem um PIX pendente</b> de ' + brl(r.amount) + '. Seu pedido está reservado até o pagamento.</p>' +
      '<div class="bm-pix-banner-acoes">' +
        '<button type="button" class="bm-btn bm-btn--sm" data-retomar>Ver código PIX</button>' +
        '<button type="button" class="bm-pix-banner-x" data-dispensar aria-label="Dispensar aviso">&times;</button>' +
      '</div>';
    var header = document.querySelector('.bm-header');
    if (header && header.parentNode) header.parentNode.insertBefore(banner, header.nextSibling);
    else document.body.insertBefore(banner, document.body.firstChild);
    banner.addEventListener('click', function (e) {
      if (e.target.closest('[data-retomar]')) retomarPix();
      else if (e.target.closest('[data-dispensar]')) removerBanner();
    });
  }
  function removerBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function retomarPix() {
    if (!estado.resposta) return;
    removerBanner();
    abrirOverlay();
    estado.passo = 'pix';
    render();
    consultarStatus();
  }

  /* ---------------- confirmação automática ---------------- */
  var geracaoPoll = 0;     // cada novo ciclo invalida o anterior

  function iniciarPolling(inicio) {
    pararPolling();
    var minha = geracaoPoll;
    estado.pollInicio = inicio || Date.now();
    function ciclo() {
      consultarStatus().then(function (parar) {
        if (minha !== geracaoPoll) return;         // outro ciclo assumiu
        if (parar) { estado.poll = null; return; }
        if (Date.now() - estado.pollInicio > POLL_LIMITE) {
          estado.poll = null;
          var el = $('#bm-co-aguardando');
          if (el) el.innerHTML = 'Ainda não identificamos o pagamento. Se você já pagou, toque em “Já paguei” ou fale com o atendimento.';
          return;
        }
        estado.poll = setTimeout(ciclo, POLL_INTERVALO);
      });
    }
    estado.poll = setTimeout(ciclo, POLL_PRIMEIRO);
  }

  function pararPolling() {
    geracaoPoll++;
    if (estado.poll) { clearTimeout(estado.poll); estado.poll = null; }
  }

  var consultando = null, consultandoTx = '';
  function consultarStatus() {
    var r = estado.resposta;
    if (!r) return Promise.resolve(true);
    if (consultando && consultandoTx === r.transactionId) return consultando;   // evita consultas repetidas
    var url = API_STATUS + '?transactionId=' + encodeURIComponent(r.transactionId) +
              '&token=' + encodeURIComponent(r.token);
    consultandoTx = r.transactionId;
    var esta = consultando = fetch(url, { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        var s = d && d.status;
        if (estado.resposta !== r) return true;    // outro PIX foi gerado nesse meio-tempo
        if (s === 'PAID') { pagamentoConfirmado(); return true; }
        if (s === 'CANCELLED' || s === 'REFUNDED' || s === 'EXPIRED') {
          limparPendente();
          evento(s === 'EXPIRED' ? 'pix_expired' : 'pix_cancelled', { externalRef: r.externalRef });
          var el = $('#bm-co-status');
          if (el) el.innerHTML = '<p class="bm-co-aguardando bm-co-aguardando--fim">' + (s === 'EXPIRED'
            ? 'Este PIX expirou. Feche esta janela e gere um novo código para continuar.'
            : 'Este pagamento foi cancelado. Feche esta janela e gere um novo PIX para continuar.') + '</p>';
          return true;
        }
        return false;
      })
      .catch(function () { return false; })
      .then(function (parar) { if (consultando === esta) consultando = null; return parar; });
    return esta;
  }

  function pagamentoConfirmado() {
    pararPolling();
    var r = estado.resposta;
    // purchase só dispara com pagamento realmente confirmado, e uma vez por pedido
    if (!compraRegistrada(r.externalRef)) {
      try { localStorage.setItem('bm_compra_' + r.externalRef, '1'); } catch (e) {}
      evento('purchase', {
        value: r.amount / 100,
        currency: 'BRL',
        plan: estado.pedido.plan,
        products: estado.pedido.produtos,
        externalRef: r.externalRef,
        transaction_id: r.transactionId
      });
    }
    gravarLocal(CHAVE_ULTIMO, { ref: r.externalRef, pagoEm: Date.now() });
    limparPendente();
    if (!estado.aberto) abrirOverlay();
    estado.passo = 'confirmado';
    render();
  }

  /* ---------------- abrir e fechar ---------------- */
  var focoAnterior = null;
  function abrirOverlay() {
    if (!overlay) criarOverlay();
    if (!estado.aberto) focoAnterior = document.activeElement;
    estado.aberto = true;
    overlay.hidden = false;
    document.documentElement.classList.add('bm-travado', 'bm-co-aberto');
    var painel = overlay.querySelector('.bm-co-painel');
    if (painel) painel.focus();
  }

  function abrir(pedido) {
    if (!pedido || !pedido.completo) return;
    recuperar();
    pararPolling();
    removerBanner();

    estado.pedido = pedido;
    estado.resposta = null;
    estado.enviando = false;
    estado.passo = 'dados';

    abrirOverlay();
    evento('begin_checkout', {
      plan: pedido.plan, products: pedido.produtos,
      value: pedido.total / 100, currency: 'BRL'
    }, { unico: 'begin_checkout_' + pedido.plan });
    render();
    var primeiro = overlay.querySelector('input');
    if (primeiro && !telaPequena()) primeiro.focus();
  }

  function fechar() {
    if (!estado.aberto) return;
    evento('checkout_close', { step: estado.passo, plan: estado.pedido && estado.pedido.plan });
    estado.aberto = false;
    overlay.hidden = true;
    document.documentElement.classList.remove('bm-travado', 'bm-co-aberto');

    if (estado.passo === 'pix' && estado.resposta) {
      /* PIX gerado e não pago: continua conferindo e deixa um atalho para voltar */
      mostrarBanner();
    } else {
      pararPolling();
      if (estado.passo === 'confirmado') { estado.resposta = null; estado.passo = 'dados'; }
    }
    if (focoAnterior && focoAnterior.focus && document.body.contains(focoAnterior)) {
      try { focoAnterior.focus({ preventScroll: true }); } catch (e) { focoAnterior.focus(); }
    }
  }

  /* volta para a aba: confere na hora se o pagamento já caiu */
  var ultimaVisita = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !estado.resposta) return;
    if (estado.passo === 'confirmado') return;
    if (Date.now() - ultimaVisita < 3000) return;
    ultimaVisita = Date.now();
    consultarStatus().then(function (parar) {
      if (!parar && !estado.poll && Date.now() - (estado.criadoEm || 0) < POLL_LIMITE) iniciarPolling(estado.criadoEm);
    });
  });

  function iniciarPendente() {
    var p = lerPendente();
    if (!p) return;
    estado.pedido = p.pedido;
    estado.resposta = p.resposta;
    estado.criadoEm = p.criadoEm;
    estado.passo = 'pix';
    recuperar();
    consultarStatus().then(function (parar) {
      if (parar) return;
      mostrarBanner();
      if (Date.now() - p.criadoEm < POLL_LIMITE) iniciarPolling(p.criadoEm);
    });
  }

  /* ---------------- integração com a landing page ---------------- */
  capturarUTM();
  window.addEventListener('bodyman:checkout', function (e) { abrir(e.detail); });
  window.BodymanCheckout = {
    abrir: abrir, fechar: fechar, retomarPix: retomarPix,
    passo: function () { return estado.passo; }
  };
  try { iniciarPendente(); } catch (e) { if (window.console) console.error('[bodyman]', e); }
})();
