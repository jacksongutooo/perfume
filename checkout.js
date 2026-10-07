/* =====================================================================
   BODYMAN — CHECKOUT PIX (BlackCat)

   Este arquivo cuida só da experiência de checkout. Nenhum preço daqui
   é usado para cobrar: o servidor recalcula tudo a partir do plano.
   A API Key da BlackCat não existe neste arquivo e nunca deve existir.

   Etapas: Dados → Entrega → Pagamento (PIX) → Confirmado.
   O PIX gerado fica salvo neste aparelho até ser pago ou expirar: se a
   pessoa sair para o app do banco e a página recarregar, o código e a
   confirmação automática continuam funcionando.
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
  var NOME_PLANO = { triple: 'Kit completo — 3 frascos', double: '2 frascos', single: '1 frasco' };

  var POLL_PRIMEIRO = 5000;      // primeira consulta
  var POLL_INTERVALO = 6000;     // depois
  var POLL_LIMITE = 30 * 60000;  // depois de 30 min, só consulta quando a pessoa pedir
  var CHAVE_PENDENTE = 'bm_pix_pendente';

  var estado = {
    aberto: false,
    passo: 'dados',
    pedido: null,          // seleção vinda da página
    resposta: null,        // resposta do /api/create-payment
    enviando: false,
    poll: null,
    pollInicio: 0,
    historico: false,
    restaurado: false,
    dados: { name: '', email: '', phone: '', cpf: '' },
    endereco: { zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
  };

  /* ---------------- utilidades ---------------- */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var digitos = function (v) { return String(v || '').replace(/\D/g, ''); };
  var brl = function (centavos) {
    var s = (centavos / 100).toFixed(2).split('.');
    return 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  };
  var escapar = function (t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  function BMx() { return window.BM || null; }
  function track(nome, dados) { var b = BMx(); if (b && b.track) b.track(nome, dados); }
  function whats(msg) {
    var b = BMx();
    return b && b.whatsLink ? b.whatsLink(msg) : 'https://wa.me/5516995417328?text=' + encodeURIComponent(msg || '');
  }

  function guardar() {
    try {
      sessionStorage.setItem('bm_checkout', JSON.stringify({ dados: estado.dados, endereco: estado.endereco }));
    } catch (e) {}
  }
  function recuperar() {
    try {
      var s = JSON.parse(sessionStorage.getItem('bm_checkout') || '{}');
      if (s.dados) estado.dados = Object.assign(estado.dados, s.dados);
      if (s.endereco) estado.endereco = Object.assign(estado.endereco, s.endereco);
    } catch (e) {}
  }

  /* ---------------- UTMs (capturadas pelo site.js na chegada) ---------------- */
  function utmAtual() {
    try { return JSON.parse(sessionStorage.getItem('bm_utm') || '{}'); } catch (e) { return {}; }
  }

  /* ---------------- PIX pendente salvo no aparelho ---------------- */
  function salvarPendente() {
    var r = estado.resposta, p = estado.pedido;
    if (!r || !p) return;
    try {
      localStorage.setItem(CHAVE_PENDENTE, JSON.stringify({
        salvoEm: Date.now(),
        pedido: { plan: p.plan, produtos: p.produtos, total: p.total, frascos: p.frascos },
        resposta: {
          externalRef: r.externalRef, transactionId: r.transactionId, token: r.token,
          amount: r.amount, testMode: !!r.testMode,
          pix: { copyPaste: (r.pix && r.pix.copyPaste) || '', expiresAt: (r.pix && r.pix.expiresAt) || null }
        },
        local: { city: estado.endereco.city, state: estado.endereco.state }
      }));
    } catch (e) {}
  }
  function lerPendente() {
    try {
      var p = JSON.parse(localStorage.getItem(CHAVE_PENDENTE) || 'null');
      if (!p || !p.resposta || !p.resposta.transactionId || !p.resposta.token) return null;
      var exp = p.resposta.pix && p.resposta.pix.expiresAt ? Date.parse(p.resposta.pix.expiresAt) : NaN;
      if (isNaN(exp)) exp = p.salvoEm + 24 * 3600000;
      if (Date.now() > exp || Date.now() - p.salvoEm > 48 * 3600000) { limparPendente(); return null; }
      return p;
    } catch (e) { return null; }
  }
  function limparPendente() {
    try { localStorage.removeItem(CHAVE_PENDENTE); } catch (e) {}
    var b = document.getElementById('bm-pendente');
    if (b) b.parentNode.removeChild(b);
  }

  /* ---------------- máscaras ---------------- */
  function mascaraCPF(v) {
    var d = digitos(v).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  function mascaraTelefone(v) {
    var d = digitos(v);
    if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);   // autopreenchido com +55
    d = d.slice(0, 11);
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
    cadeado: '<svg class="bm-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    escudo: '<svg class="bm-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    balao: '<svg class="bm-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    whats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="bm-wa-bolha" d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z"/><path class="bm-wa-fone" d="M8.9 7.9c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.2-.1.3 0 .5.6 1 1.4 1.8 2.4 2.4.2.1.4.1.5 0l.6-.5c.2-.2.4-.2.6-.1l1.7.7c.3.1.4.3.4.5v.5c0 .3-.1.5-.4.7-.5.3-1.2.5-1.9.4-1.4-.2-2.8-1-3.9-2.1s-1.9-2.5-2.1-3.9c-.1-.7.1-1.4.4-1.9z"/></svg>'
  };

  /* ---------------- markup ---------------- */
  var overlay = null;

  function criarOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'bm-co';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Finalizar compra');
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="bm-co-fundo" data-fechar-fundo></div>' +
      '<div class="bm-co-painel">' +
        '<header class="bm-co-topo">' +
          '<div class="bm-co-passos" id="bm-co-passos"></div>' +
          '<button type="button" class="bm-co-x" data-fechar aria-label="Fechar">&times;</button>' +
        '</header>' +
        '<div class="bm-co-corpo" id="bm-co-corpo"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-fechar]')) { fechar(); return; }
      /* tocar fora fecha, exceto na tela do PIX (evita perder o código sem querer) */
      if (t.hasAttribute('data-fechar-fundo') && estado.passo !== 'pix') { fechar(); return; }
      if (t.closest('[data-alterar]')) {
        fechar();
        if (window.BODYMAN && window.BODYMAN.irParaOferta) setTimeout(window.BODYMAN.irParaOferta, 60);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && estado.aberto) fechar();
    });
    window.addEventListener('popstate', function () {
      if (estado.aberto) { estado.historico = false; fechar(); }
      setTimeout(function () { try { history.scrollRestoration = 'auto'; } catch (e) {} }, 0);
    });
  }

  function trilha() {
    var passos = [
      { id: 'dados', rotulo: 'Dados' },
      { id: 'endereco', rotulo: 'Entrega' },
      { id: 'pix', rotulo: 'Pagamento' }
    ];
    var pos = estado.passo === 'confirmado' ? 3 : passos.map(function (p) { return p.id; }).indexOf(estado.passo);
    $('#bm-co-passos').innerHTML = passos.map(function (p, i) {
      var cls = i < pos ? 'feito' : (i === pos ? 'ativo' : '');
      return (i ? '<span class="bm-co-passo-sep" aria-hidden="true"></span>' : '') +
        '<span class="bm-co-passo ' + cls + '"' + (i === pos ? ' aria-current="step"' : '') + '><i>' + (i < pos ? '✓' : i + 1) + '</i>' + p.rotulo + '</span>';
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
        (o.enterkeyhint ? ' enterkeyhint="' + o.enterkeyhint + '"' : '') +
        ' value="' + escapar(o.valor || '') + '">' +
      '<em class="bm-co-erro" data-erro-de="' + id + '"></em>' +
    '</label>';
  }

  function nomesProdutos(p) {
    return p.produtos.map(function (s) { return (PRODUTOS[s] || s).replace('Bodyman ', ''); }).join(', ');
  }

  /* resumo do pedido no topo: preço final, frete e quantidade antes dos dados */
  function resumoTopo(expandido) {
    var p = estado.pedido;
    var qtd = p.produtos.length;
    var promo = p.cheio > p.total && p.descontoPct > 0;
    return '<div class="bm-co-pedido">' +
      '<div class="bm-co-pedido-linha">' +
        '<div><p class="bm-co-pedido-nome">' + escapar(NOME_PLANO[p.plan] || 'Seu pedido') + '</p>' +
        '<p class="bm-co-pedido-sub">' + escapar(nomesProdutos(p)) + ' · ' + (qtd * 200) + ' ml</p>' +
        (promo ? '<p class="bm-co-pedido-off">' + p.descontoPct + '% OFF no PIX aplicado</p>' : '') + '</div>' +
        '<span class="bm-co-pedido-total">' + (promo ? '<s>' + brl(p.cheio) + '</s>' : '') + brl(p.total) + '</span>' +
      '</div>' +
      (expandido
        ? '<dl class="bm-co-pedido-det">' +
            '<div><dt>Quantidade</dt><dd>' + qtd + (qtd > 1 ? ' frascos' : ' frasco') + ' de 200 ml</dd></div>' +
            (promo
              ? '<div><dt>Preço do kit</dt><dd>' + brl(p.cheio) + '</dd></div>' +
                '<div><dt>' + p.descontoPct + '% OFF no PIX</dt><dd class="bm-gratis">−' + brl(p.cheio - p.total) + '</dd></div>'
              : '') +
            '<div><dt>Frete</dt><dd class="bm-gratis">Grátis</dd></div>' +
            '<div><dt>Total no PIX</dt><dd>' + brl(p.total) + '</dd></div>' +
          '</dl>' +
          '<ul class="bm-co-selos">' +
            '<li>' + ICO.cadeado + 'Pagamento seguro</li>' +
            '<li>' + ICO.escudo + 'Pedido protegido</li>' +
            '<li>' + ICO.balao + 'Atendimento disponível</li>' +
          '</ul>'
        : '') +
      (estado.restaurado ? '' : '<button type="button" class="bm-co-alterar" data-alterar>Alterar pedido</button>') +
    '</div>';
  }

  function resumoItens() {
    return estado.pedido.produtos.map(function (s) {
      return '<li><span>1x ' + escapar(PRODUTOS[s] || s) + '</span><span>200 ml</span></li>';
    }).join('');
  }

  /* ---------------- telas ---------------- */
  function telaDados() {
    var d = estado.dados;
    return resumoTopo(true) +
      '<h2 class="bm-co-titulo">Seus dados</h2>' +
      '<p class="bm-co-sub">Para registrar o pedido e enviar a confirmação e o rastreio.</p>' +
      '<div class="bm-co-grid">' +
        campo('bm-nome', 'Nome completo', { valor: d.name, autocomplete: 'name', placeholder: 'Nome e sobrenome', enterkeyhint: 'next' }) +
        campo('bm-email', 'E-mail', { valor: d.email, tipo: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'voce@email.com', enterkeyhint: 'next' }) +
        campo('bm-tel', 'Celular / WhatsApp', { valor: d.phone, tipo: 'tel', inputmode: 'tel', autocomplete: 'tel-national', placeholder: '(00) 00000-0000', maxlength: 15, largura: 'metade', enterkeyhint: 'next' }) +
        campo('bm-cpf', 'CPF', { valor: d.cpf, inputmode: 'numeric', placeholder: '000.000.000-00', maxlength: 14, largura: 'metade', enterkeyhint: 'done' }) +
      '</div>' +
      '<p class="bm-co-sub" style="font-size:12.5px;margin:-6px 0 16px">O CPF é exigido pelo intermediador de pagamentos para gerar o PIX.</p>' +
      '<button type="button" class="bm-btn bm-btn--lg" id="bm-co-avancar">Continuar para a entrega</button>' +
      '<p class="bm-co-legal">Ao continuar, você concorda com os <a href="termos-de-uso.html" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="politica-de-privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</p>';
  }

  function telaEndereco() {
    var e = estado.endereco, p = estado.pedido;
    return resumoTopo(false) +
      '<h2 class="bm-co-titulo">Endereço de entrega</h2>' +
      '<p class="bm-co-sub">Frete grátis para todo o Brasil.</p>' +
      '<div class="bm-co-grid">' +
        campo('bm-cep', 'CEP', { valor: e.zipCode ? mascaraCEP(e.zipCode) : '', inputmode: 'numeric', autocomplete: 'postal-code', placeholder: '00000-000', maxlength: 9, largura: 'metade' }) +
        '<span class="bm-co-cepstatus" id="bm-co-cepstatus" aria-live="polite"></span>' +
        campo('bm-rua', 'Rua / logradouro', { valor: e.street, autocomplete: 'address-line1' }) +
        campo('bm-num', 'Número', { valor: e.number, inputmode: 'numeric', largura: 'metade' }) +
        campo('bm-compl', 'Complemento', { valor: e.complement, autocomplete: 'address-line2', largura: 'metade', placeholder: 'Opcional' }) +
        campo('bm-bairro', 'Bairro', { valor: e.neighborhood }) +
        campo('bm-cidade', 'Cidade', { valor: e.city, autocomplete: 'address-level2', largura: 'metade' }) +
        campo('bm-uf', 'UF', { valor: e.state, autocomplete: 'address-level1', maxlength: 2, largura: 'metade', placeholder: 'SP' }) +
      '</div>' +
      '<p class="bm-co-msg" id="bm-co-msg" role="alert"></p>' +
      '<div class="bm-co-acoes">' +
        '<button type="button" class="bm-btn bm-btn--ghost" id="bm-co-voltar">Voltar</button>' +
        '<button type="button" class="bm-btn bm-btn--lg" id="bm-co-pix">Gerar PIX — ' + brl(p.total) + '</button>' +
      '</div>' +
      '<p class="bm-co-legal">O código PIX aparece na próxima tela. O pedido é confirmado assim que o pagamento é aprovado.</p>';
  }

  function validadeTexto(iso) {
    var t = Date.parse(iso || '');
    if (isNaN(t)) return '';
    try {
      var d = new Date(t);
      var data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
      var hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      return data && hora ? 'Código válido até ' + data + ', às ' + hora : '';
    } catch (e) { return ''; }
  }

  function telaPix() {
    var r = estado.resposta;
    var codigo = (r.pix && r.pix.copyPaste) || '';
    var validade = validadeTexto(r.pix && r.pix.expiresAt);
    var computador = window.innerWidth >= 640;
    return (r.testMode ? '<p class="bm-co-teste">Modo de teste — nenhuma cobrança real foi criada. Não pague este código.</p>' : '') +
      '<div class="bm-co-pix-topo">' +
        '<span class="bm-co-pix-selo">✓ Pedido reservado</span>' +
        '<h2 class="bm-co-titulo">Pagamento via PIX</h2>' +
        '<p class="bm-co-sub" style="margin:0">Seu pedido foi reservado. Finalize o pagamento para confirmar sua compra.</p>' +
        '<p class="bm-co-valor">' + brl(r.amount) + '</p>' +
        (validade ? '<p class="bm-co-validade">' + validade + '</p>' : '') +
      '</div>' +
      '<ol class="bm-co-passos-pix">' +
        '<li>Copie o código PIX abaixo</li>' +
        '<li>Abra o aplicativo do seu banco</li>' +
        '<li>Vá até PIX</li>' +
        '<li>Escolha PIX Copia e Cola</li>' +
        '<li>Cole o código</li>' +
        '<li>Confirme o pagamento</li>' +
      '</ol>' +
      '<textarea class="bm-co-codigo" id="bm-co-codigo" readonly rows="3" aria-label="Código PIX copia e cola">' + escapar(codigo) + '</textarea>' +
      '<button type="button" class="bm-btn bm-btn--lg bm-co-copiar" id="bm-co-copiar" style="margin-top:12px">Copiar código PIX</button>' +
      '<p class="bm-co-feedback" id="bm-co-feedback" role="status" aria-live="polite"></p>' +
      '<p class="bm-co-aguardando" id="bm-co-aguardando"><span class="bm-co-pulso"></span> Aguardando pagamento…</p>' +
      '<p class="bm-co-auto" id="bm-co-auto">Após o pagamento, aguarde alguns segundos. A confirmação acontece automaticamente.</p>' +
      '<details class="bm-co-qr-bloco" id="bm-co-qr-bloco"' + (computador ? ' open' : '') + '>' +
        '<summary>Pagar com QR Code</summary>' +
        '<div class="bm-co-qr" id="bm-co-qr-canvas"></div>' +
        '<p class="bm-co-auto">Leia o QR Code com o app do banco em outro aparelho.</p>' +
      '</details>' +
      '<a class="bm-btn bm-btn--ghost bm-co-ajuda" data-wa="pix" target="_blank" rel="noopener" href="' +
        escapar(whats('Olá! Estou finalizando o pagamento do pedido ' + r.externalRef + ' pelo PIX e preciso de ajuda.')) + '">' +
        ICO.whats + 'Precisa de ajuda?</a>' +
      '<p class="bm-co-ref">Pedido ' + escapar(r.externalRef) + '</p>';
  }

  function textoPostagem() {
    var B = window.BODYMAN;
    try {
      var st = B && B.statusEnvio ? B.statusEnvio() : null;
      var corte = B && B.rotuloCorte ? B.rotuloCorte() : '12h';
      if (st && st.noPrazo) return 'Pagamento confirmado até as ' + corte + ' em dia útil: seu pedido é postado hoje.';
    } catch (e) {}
    return 'Seu pedido será postado em até 1 dia útil.';
  }

  function telaConfirmado() {
    var r = estado.resposta, e = estado.endereco;
    var local = e.street
      ? escapar(e.street) + ', ' + escapar(e.number) + ' · ' + escapar(e.city) + '/' + escapar(e.state) + (e.zipCode ? ' · ' + mascaraCEP(e.zipCode) : '')
      : (e.city ? escapar(e.city) + '/' + escapar(e.state) : '');
    return '<div class="bm-co-ok">' +
      '<div class="bm-co-selo" aria-hidden="true">✓</div>' +
      '<h2 class="bm-co-titulo">Pagamento confirmado</h2>' +
      '<p class="bm-co-sub">Pedido recebido com sucesso! Já estamos preparando seu pedido para envio.</p>' +
      '<p class="bm-co-ref">Número do pedido<br><strong>' + escapar(r.externalRef) + '</strong></p>' +
      '<ul class="bm-co-itens">' + resumoItens() + '</ul>' +
      (local ? '<p class="bm-co-entrega">Entrega: ' + local + '</p>' : '') +
      '<p class="bm-co-envio">' + textoPostagem() + ' Você recebe o código de rastreio assim que o pedido for postado.</p>' +
      '<button type="button" class="bm-btn bm-btn--lg" data-fechar>Fechar</button>' +
      '<a class="bm-btn bm-btn--ghost bm-co-ajuda" data-wa="confirmado" target="_blank" rel="noopener" href="' +
        escapar(whats('Olá! Acabei de pagar o pedido ' + r.externalRef + ' no site da Bodyman.')) + '">' + ICO.whats + 'Falar com o atendimento</a>' +
    '</div>';
  }

  /* ---------------- render ---------------- */
  function render() {
    var corpo = $('#bm-co-corpo');
    if (estado.passo === 'dados') corpo.innerHTML = telaDados();
    else if (estado.passo === 'endereco') corpo.innerHTML = telaEndereco();
    else if (estado.passo === 'pix') corpo.innerHTML = telaPix();
    else corpo.innerHTML = telaConfirmado();

    trilha();
    corpo.scrollTop = 0;
    ligarEventos();
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
    Array.prototype.forEach.call(overlay.querySelectorAll('input.erro'), function (e) { e.classList.remove('erro'); e.removeAttribute('aria-invalid'); });
  }
  function focarPrimeiroErro() {
    var el = overlay.querySelector('input.erro');
    if (el) { try { el.focus(); el.scrollIntoView({ block: 'center' }); } catch (e) {} }
  }

  /* ---------------- ligações de cada tela ---------------- */
  function ligarEventos() {
    var voltar = $('#bm-co-voltar');
    if (voltar) voltar.addEventListener('click', function () { estado.passo = 'dados'; render(); });

    if (estado.passo === 'dados') ligarDados();
    if (estado.passo === 'endereco') ligarEndereco();
    if (estado.passo === 'pix') ligarPix();
  }

  /* Enter avança de campo em campo no celular */
  function enterAvanca(ids, final) {
    ids.forEach(function (id, i) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var prox = document.getElementById(ids[i + 1]);
        if (prox) prox.focus(); else if (final) final();
      });
    });
  }

  function ligarDados() {
    var tel = $('#bm-tel'), cpf = $('#bm-cpf');
    tel.addEventListener('input', function () { tel.value = mascaraTelefone(tel.value); });
    cpf.addEventListener('input', function () { cpf.value = mascaraCPF(cpf.value); });

    function avancar() {
      limparErros();
      var d = {
        name: $('#bm-nome').value.trim(),
        email: $('#bm-email').value.trim(),
        phone: $('#bm-tel').value,
        cpf: $('#bm-cpf').value
      };
      var ok = true;
      if (!nomeOk(d.name)) { mostrarErro('bm-nome', 'Informe nome e sobrenome.'); ok = false; }
      if (!emailOk(d.email)) { mostrarErro('bm-email', 'Confira o e-mail.'); ok = false; }
      if (!telefoneOk(d.phone)) { mostrarErro('bm-tel', 'Informe o celular com DDD.'); ok = false; }
      if (!cpfOk(d.cpf)) { mostrarErro('bm-cpf', 'CPF inválido. Confira os números.'); ok = false; }
      if (!ok) { focarPrimeiroErro(); return; }

      estado.dados = d;
      guardar();
      track('add_customer_info', { offer: estado.pedido.plan });
      estado.passo = 'endereco';
      render();
    }
    $('#bm-co-avancar').addEventListener('click', avancar);
    enterAvanca(['bm-nome', 'bm-email', 'bm-tel', 'bm-cpf'], avancar);
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

  function ligarEndereco() {
    var cep = $('#bm-cep');
    cep.addEventListener('input', function () {
      cep.value = mascaraCEP(cep.value);
      if (digitos(cep.value).length === 8) buscarCEP(digitos(cep.value));
    });
    $('#bm-uf').addEventListener('input', function (e) {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    });
    /* guarda o que foi digitado mesmo se a pessoa voltar */
    Array.prototype.forEach.call(overlay.querySelectorAll('.bm-co-grid input'), function (i) {
      i.addEventListener('change', function () { estado.endereco = lerEndereco(); guardar(); });
    });

    function validarEGerar() {
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
      track('add_shipping_info', { offer: estado.pedido.plan });
      gerarPix();
    }
    $('#bm-co-pix').addEventListener('click', validarEGerar);
    enterAvanca(['bm-cep', 'bm-rua', 'bm-num', 'bm-compl', 'bm-bairro', 'bm-cidade', 'bm-uf'], validarEGerar);
  }

  /* Busca de CEP: conveniência. Se falhar, o cliente digita e a compra segue. */
  function buscarCEP(cep) {
    var status = $('#bm-co-cepstatus');
    if (status) status.textContent = 'Buscando endereço…';
    fetch('https://viacep.com.br/ws/' + cep + '/json/')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.erro) { if (status) status.textContent = 'CEP não encontrado. Preencha manualmente.'; return; }
        if (d.logradouro && !$('#bm-rua').value) $('#bm-rua').value = d.logradouro;
        if (d.bairro && !$('#bm-bairro').value) $('#bm-bairro').value = d.bairro;
        if (d.localidade) $('#bm-cidade').value = d.localidade;
        if (d.uf) $('#bm-uf').value = d.uf;
        if (status) status.textContent = 'Endereço encontrado. Confira e complete o número.';
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
    if (botao) { botao.disabled = true; botao.textContent = 'Gerando PIX…'; }
    if (msg) msg.textContent = '';

    var B = BMx();
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
        utm: utmAtual(),
        context: B && B.contexto ? B.contexto({ offer: estado.pedido.plan, cta: estado.pedido.cta || '' }) : {}
      })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, corpo: j || {} }; });
      })
      .then(function (r) {
        if (!r.ok || !r.corpo.ok) throw new Error(r.corpo && r.corpo.error ? r.corpo.error : 'falha');
        estado.resposta = r.corpo;
        estado.restaurado = false;
        salvarPendente();
        track('pix_generated', {
          offer: estado.pedido.plan, value: r.corpo.amount / 100, num_items: estado.pedido.produtos.length,
          products: estado.pedido.produtos, order_id: r.corpo.externalRef
        });
        estado.passo = 'pix';
        render();
      })
      .catch(function (e) {
        var texto = e && e.message && e.message !== 'falha' && !/fetch|network|load failed/i.test(e.message)
          ? e.message
          : 'Não conseguimos gerar o pagamento agora. Confira sua conexão e tente novamente.';
        track('pix_error', { offer: estado.pedido.plan, message: String(texto).slice(0, 100) });
        if (msg) msg.textContent = texto;
        if (botao) { botao.disabled = false; botao.textContent = 'Gerar PIX — ' + brl(estado.pedido.total); }
      })
      .then(function () { estado.enviando = false; });
  }

  /* ---------------- tela do PIX ---------------- */
  function ligarPix() {
    var r = estado.resposta;
    var codigo = (r.pix && r.pix.copyPaste) || '';
    var area = $('#bm-co-codigo');
    var botao = $('#bm-co-copiar');
    var feedback = $('#bm-co-feedback');
    var volta = null;

    botao.addEventListener('click', function () {
      copiar(codigo).then(function (metodo) {
        if (volta) clearTimeout(volta);
        if (metodo) {
          botao.textContent = 'Código PIX copiado!';
          botao.classList.add('copiado');
          feedback.classList.remove('erro');
          feedback.textContent = 'Código PIX copiado! Agora abra o app do seu banco e escolha PIX Copia e Cola.';
          volta = setTimeout(function () { botao.textContent = 'Copiar código PIX'; botao.classList.remove('copiado'); }, 4000);
        } else {
          /* não deu para copiar sozinho: seleciona o código para cópia manual */
          feedback.classList.add('erro');
          feedback.textContent = 'Não foi possível copiar automaticamente. Toque e segure no código acima e escolha "Copiar".';
          try { area.focus(); area.select(); area.setSelectionRange(0, codigo.length); } catch (e) {}
        }
        track('pix_copied', { order_id: r.externalRef, offer: estado.pedido.plan, method: metodo || 'falhou' });
      });
    });

    var qr = $('#bm-co-qr-bloco');
    if (qr) {
      if (qr.open) montarQR(r);
      qr.addEventListener('toggle', function () { if (qr.open) montarQR(r); });
    }

    iniciarPolling();
  }

  /* Cópia: primeiro o método síncrono (funciona nos navegadores internos do
     Instagram/Facebook), depois a API de área de transferência. Só mostra
     "copiado" quando a cópia realmente aconteceu. */
  function copiaAntiga(texto) {
    var span = document.createElement('span');
    span.textContent = texto;
    span.style.cssText = 'position:fixed;top:0;left:0;clip:rect(0,0,0,0);white-space:pre;-webkit-user-select:text;user-select:text;font-size:16px;';
    document.body.appendChild(span);
    var ok = false;
    try {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(range);
      ok = document.execCommand('copy');
      sel.removeAllRanges();
    } catch (e) { ok = false; }
    document.body.removeChild(span);
    return ok;
  }
  function copiar(texto) {
    if (!texto) return Promise.resolve(null);
    if (copiaAntiga(texto)) return Promise.resolve('execCommand');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).then(function () { return 'clipboard'; }, function () { return null; });
    }
    return Promise.resolve(null);
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
    if (!alvo || alvo.getAttribute('data-ok')) return;
    alvo.setAttribute('data-ok', '1');
    var codigo = (r.pix && (r.pix.copyPaste || r.pix.qrCode)) || '';
    var src = fonteImagemQR(r.pix && r.pix.qrCodeBase64);

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

  /* ---------------- confirmação automática ---------------- */
  function iniciarPolling() {
    pararPolling();
    estado.pollInicio = Date.now();
    estado.poll = setTimeout(function ciclo() {
      consultarStatus().then(function (parar) {
        if (parar || !estado.resposta) return;
        if (Date.now() - estado.pollInicio > POLL_LIMITE) { oferecerVerificacao(); return; }
        estado.poll = setTimeout(ciclo, POLL_INTERVALO);
      });
    }, POLL_PRIMEIRO);
  }

  function pararPolling() {
    if (estado.poll) { clearTimeout(estado.poll); estado.poll = null; }
  }

  /* depois de 30 min sem confirmação: um botão para consultar de novo */
  function oferecerVerificacao() {
    var el = $('#bm-co-aguardando');
    if (!el || $('#bm-co-verificar')) return;
    el.innerHTML = 'Ainda não recebemos a confirmação deste PIX.';
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'bm-co-verificar';
    b.className = 'bm-btn bm-btn--sm bm-co-verificar';
    b.textContent = 'Já paguei — verificar agora';
    b.addEventListener('click', function () {
      b.disabled = true; b.textContent = 'Verificando…';
      consultarStatus().then(function (parar) {
        if (!parar) { b.disabled = false; b.textContent = 'Já paguei — verificar agora'; }
      });
    });
    el.parentNode.insertBefore(b, el.nextSibling);
  }

  function consultarStatus(resposta) {
    var r = resposta || estado.resposta;
    if (!r) return Promise.resolve(true);
    var url = API_STATUS + '?transactionId=' + encodeURIComponent(r.transactionId) +
              '&token=' + encodeURIComponent(r.token);
    return fetch(url, { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        var s = d && d.status;
        if (resposta) return s || 'UNKNOWN';           // consulta avulsa (PIX salvo)
        if (s === 'PAID') { pagamentoConfirmado(); return true; }
        if (s === 'CANCELLED' || s === 'REFUNDED' || s === 'EXPIRED') { pixEncerrado(s); return true; }
        return false;
      })
      .catch(function () { return resposta ? 'ERRO' : false; });
  }

  function pixEncerrado(s) {
    limparPendente();
    var el = $('#bm-co-aguardando');
    if (!el) return;
    el.innerHTML = s === 'EXPIRED'
      ? 'Este PIX expirou. Gere um novo código para continuar.'
      : 'Este pagamento foi cancelado. Gere um novo PIX para continuar.';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bm-btn bm-btn--lg';
    b.textContent = 'Gerar novo PIX';
    b.addEventListener('click', function () {
      estado.resposta = null;
      estado.restaurado = false;
      recuperar();
      estado.passo = estado.endereco.zipCode ? 'endereco' : 'dados';
      render();
    });
    el.parentNode.insertBefore(b, el.nextSibling);
  }

  function pagamentoConfirmado() {
    pararPolling();
    var r = estado.resposta;
    // purchase só dispara com pagamento confirmado pelo servidor
    track('purchase', {
      value: r.amount / 100,
      offer: estado.pedido.plan,
      products: estado.pedido.produtos,
      num_items: estado.pedido.produtos.length,
      order_id: r.externalRef,
      transaction_id: r.transactionId
    });
    limparPendente();
    estado.passo = 'confirmado';
    if (!estado.aberto) abrirModal();
    render();
  }

  /* volta do app do banco: consulta na hora, sem esperar o próximo ciclo */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && estado.aberto && estado.passo === 'pix' && estado.resposta) {
      consultarStatus();
    }
  });

  /* ---------------- abrir e fechar ---------------- */
  function abrirModal() {
    if (!overlay) criarOverlay();
    estado.aberto = true;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('bm-co-aberto');
    try { window.dispatchEvent(new CustomEvent('bodyman:checkout_estado')); } catch (e) {}
    try {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      history.pushState({ bmModal: 'checkout' }, '');
      estado.historico = true;
    } catch (e) { estado.historico = false; }
  }

  function abrir(pedido) {
    if (!pedido || !pedido.completo) return;
    recuperar();

    estado.pedido = pedido;
    estado.resposta = null;
    estado.enviando = false;
    estado.restaurado = false;
    estado.passo = 'dados';

    abrirModal();
    track('begin_checkout', {
      offer: pedido.plan, products: pedido.produtos, num_items: pedido.produtos.length,
      value: pedido.total / 100, cta: pedido.cta || ''
    });
    render();
    var primeiro = overlay.querySelector('input');
    if (primeiro && window.innerWidth > 820) primeiro.focus();
  }

  /* PIX salvo neste aparelho (ex.: depois de voltar do app do banco) */
  function restaurar(p) {
    recuperar();
    estado.pedido = { plan: p.pedido.plan, produtos: p.pedido.produtos || [], total: p.pedido.total, frascos: p.pedido.frascos, completo: true };
    estado.resposta = p.resposta;
    if (!estado.endereco.city && p.local) { estado.endereco.city = p.local.city || ''; estado.endereco.state = p.local.state || ''; }
    estado.restaurado = true;
  }
  function abrirPendente(p) {
    restaurar(p);
    estado.passo = 'pix';
    abrirModal();
    render();
  }

  function fechar() {
    if (!estado.aberto) return;
    pararPolling();
    estado.aberto = false;
    overlay.hidden = true;
    document.body.style.overflow = '';
    document.documentElement.classList.remove('bm-co-aberto');
    try { window.dispatchEvent(new CustomEvent('bodyman:checkout_estado')); } catch (e) {}
    if (estado.historico) { estado.historico = false; try { history.back(); } catch (e) {} }
    /* PIX gerado e ainda não pago: deixa o aviso para voltar ao código */
    if (estado.resposta && estado.passo === 'pix') mostrarAvisoPendente(lerPendente());
  }

  /* ---------------- aviso de PIX pendente na página ---------------- */
  function mostrarAvisoPendente(p) {
    if (!p || document.getElementById('bm-pendente')) return;
    try { if (sessionStorage.getItem('bm_pendente_dispensado') === p.resposta.externalRef) return; } catch (e) {}
    var aviso = document.createElement('div');
    aviso.className = 'bm-pendente';
    aviso.id = 'bm-pendente';
    aviso.setAttribute('role', 'status');
    aviso.innerHTML = '<div class="bm-wrap bm-pendente-in">' +
      '<p>Seu pedido <b>' + escapar(p.resposta.externalRef) + '</b> (' + brl(p.resposta.amount) + ') está aguardando o pagamento via PIX.</p>' +
      '<div class="bm-pendente-acoes">' +
        '<button type="button" class="bm-btn bm-btn--sm" data-pendente-abrir>Ver código PIX</button>' +
        '<button type="button" class="bm-pendente-x" data-pendente-x>Dispensar</button>' +
      '</div></div>';
    var header = document.querySelector('.bm-header');
    if (header && header.parentNode) header.parentNode.insertBefore(aviso, header.nextSibling);
    else document.body.insertBefore(aviso, document.body.firstChild);
    aviso.addEventListener('click', function (e) {
      if (e.target.closest('[data-pendente-abrir]')) { var atual = lerPendente(); if (atual) abrirPendente(atual); else limparPendente(); }
      if (e.target.closest('[data-pendente-x]')) {
        try { sessionStorage.setItem('bm_pendente_dispensado', p.resposta.externalRef); } catch (err) {}
        aviso.parentNode.removeChild(aviso);
      }
    });
  }

  /* ao carregar: se existe PIX gerado neste aparelho, confere se já foi pago */
  function verificarPendenteAoCarregar() {
    var p = lerPendente();
    if (!p) return;
    consultarStatus(p.resposta).then(function (s) {
      if (s === 'PAID') {
        restaurar(p);
        pagamentoConfirmado();
      } else if (s === 'CANCELLED' || s === 'REFUNDED' || s === 'EXPIRED') {
        limparPendente();
      } else {
        mostrarAvisoPendente(p);
      }
    });
  }

  /* ---------------- integração com a página ---------------- */
  window.addEventListener('bodyman:checkout', function (e) { abrir(e.detail); });
  window.BodymanCheckout = { abrir: abrir, fechar: fechar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verificarPendenteAoCarregar);
  else verificarPendenteAoCarregar();
})();
