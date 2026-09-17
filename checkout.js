/* =====================================================================
   BODYMAN — CHECKOUT PIX (BlackCat)

   Este arquivo cuida só da experiência de checkout. Nenhum preço daqui
   é usado para cobrar: o servidor recalcula tudo a partir do plano.
   A API Key da BlackCat não existe neste arquivo e nunca deve existir.
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

  var POLL_PRIMEIRO = 5000;      // primeira consulta
  var POLL_INTERVALO = 6000;     // depois
  var POLL_LIMITE = 30 * 60000;  // desiste de consultar após 30 min

  var estado = {
    aberto: false,
    passo: 'dados',
    pedido: null,          // seleção vinda da landing page
    resposta: null,        // resposta do /api/create-payment
    enviando: false,
    poll: null,
    pollInicio: 0,
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

  /* ---------------- UTMs ---------------- */
  function capturarUTM() {
    var campos = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var atual = {};
    try { atual = JSON.parse(sessionStorage.getItem('bm_utm') || '{}'); } catch (e) {}
    var params = new URLSearchParams(location.search);
    var mudou = false;
    campos.forEach(function (c) {
      var v = params.get(c);
      if (v) { atual[c.replace('utm_', '')] = v.slice(0, 120); mudou = true; }
    });
    if (mudou) { try { sessionStorage.setItem('bm_utm', JSON.stringify(atual)); } catch (e) {} }
    return atual;
  }
  function utmAtual() {
    try { return JSON.parse(sessionStorage.getItem('bm_utm') || '{}'); } catch (e) { return {}; }
  }

  /* ---------------- eventos de analytics ---------------- */
  function evento(nome, dados) {
    var payload = Object.assign({ event: nome }, dados || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent('bodyman:' + nome, { detail: payload }));
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
      '<div class="bm-co-fundo" data-fechar></div>' +
      '<div class="bm-co-painel">' +
        '<header class="bm-co-topo">' +
          '<div class="bm-co-passos" id="bm-co-passos"></div>' +
          '<button type="button" class="bm-co-x" data-fechar aria-label="Fechar">&times;</button>' +
        '</header>' +
        '<div class="bm-co-corpo" id="bm-co-corpo"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute('data-fechar')) fechar();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && estado.aberto) fechar();
    });
  }

  function trilha() {
    var passos = [
      { id: 'dados', rotulo: 'Dados' },
      { id: 'endereco', rotulo: 'Entrega' },
      { id: 'resumo', rotulo: 'Resumo' },
      { id: 'pix', rotulo: 'Pagamento' }
    ];
    var atual = estado.passo === 'confirmado' ? 'pix' : estado.passo;
    var pos = passos.findIndex(function (p) { return p.id === atual; });
    $('#bm-co-passos').innerHTML = passos.map(function (p, i) {
      var cls = i < pos ? 'feito' : (i === pos ? 'ativo' : '');
      return '<span class="bm-co-passo ' + cls + '">' + p.rotulo + '</span>';
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
        ' value="' + escapar(o.valor || '') + '">' +
      '<em class="bm-co-erro" data-erro-de="' + id + '"></em>' +
    '</label>';
  }

  function resumoItens() {
    var p = estado.pedido;
    return p.produtos.map(function (s) {
      return '<li><span>1x ' + PRODUTOS[s] + '</span><span>200 ml</span></li>';
    }).join('');
  }

  /* ---------------- passos ---------------- */
  function telaDados() {
    var d = estado.dados;
    return '<h2 class="bm-co-titulo">Seus dados</h2>' +
      '<p class="bm-co-sub">Usamos para emitir o pedido e enviar a confirmação.</p>' +
      '<div class="bm-co-grid">' +
        campo('bm-nome', 'Nome completo', { valor: d.name, autocomplete: 'name', placeholder: 'Como no documento' }) +
        campo('bm-email', 'E-mail', { valor: d.email, tipo: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'voce@email.com' }) +
        campo('bm-tel', 'Telefone com DDD', { valor: d.phone, tipo: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '(00) 00000-0000', maxlength: 15, largura: 'metade' }) +
        campo('bm-cpf', 'CPF', { valor: d.cpf, inputmode: 'numeric', placeholder: '000.000.000-00', maxlength: 14, largura: 'metade' }) +
      '</div>' +
      '<button type="button" class="bm-btn bm-btn--lg" id="bm-co-avancar">Continuar</button>';
  }

  function telaEndereco() {
    var e = estado.endereco;
    return '<h2 class="bm-co-titulo">Endereço de entrega</h2>' +
      '<p class="bm-co-sub">Frete grátis para todo o Brasil.</p>' +
      '<div class="bm-co-grid">' +
        campo('bm-cep', 'CEP', { valor: e.zipCode, inputmode: 'numeric', autocomplete: 'postal-code', placeholder: '00000-000', maxlength: 9, largura: 'metade' }) +
        '<span class="bm-co-cepstatus" id="bm-co-cepstatus"></span>' +
        campo('bm-rua', 'Rua / logradouro', { valor: e.street, autocomplete: 'address-line1' }) +
        campo('bm-num', 'Número', { valor: e.number, inputmode: 'numeric', largura: 'metade' }) +
        campo('bm-compl', 'Complemento (opcional)', { valor: e.complement, largura: 'metade' }) +
        campo('bm-bairro', 'Bairro', { valor: e.neighborhood }) +
        campo('bm-cidade', 'Cidade', { valor: e.city, largura: 'metade' }) +
        campo('bm-uf', 'UF', { valor: e.state, maxlength: 2, largura: 'metade', placeholder: 'SP' }) +
      '</div>' +
      '<div class="bm-co-acoes">' +
        '<button type="button" class="bm-btn bm-btn--ghost" id="bm-co-voltar">Voltar</button>' +
        '<button type="button" class="bm-btn bm-btn--lg" id="bm-co-avancar">Continuar</button>' +
      '</div>';
  }

  function telaResumo() {
    var p = estado.pedido, e = estado.endereco;
    return '<h2 class="bm-co-titulo">Seu pedido</h2>' +
      '<ul class="bm-co-itens">' + resumoItens() + '</ul>' +
      '<dl class="bm-co-linhas">' +
        '<div><dt>Total de produtos</dt><dd>' + p.produtos.length + '</dd></div>' +
        '<div><dt>Volume total</dt><dd>' + (p.produtos.length * 200) + ' ml</dd></div>' +
        '<div><dt>Frete</dt><dd class="bm-co-gratis">Grátis</dd></div>' +
      '</dl>' +
      '<p class="bm-co-entrega">' + escapar(e.street) + ', ' + escapar(e.number) +
        (e.complement ? ' — ' + escapar(e.complement) : '') + '<br>' +
        escapar(e.neighborhood) + ' · ' + escapar(e.city) + '/' + escapar(e.state) + ' · ' + mascaraCEP(e.zipCode) +
      '</p>' +
      '<div class="bm-co-total"><span>Total</span><strong>' + brl(p.total) + '</strong></div>' +
      '<p class="bm-co-msg" id="bm-co-msg"></p>' +
      '<div class="bm-co-acoes">' +
        '<button type="button" class="bm-btn bm-btn--ghost" id="bm-co-voltar">Voltar</button>' +
        '<button type="button" class="bm-btn bm-btn--lg" id="bm-co-pix">Gerar PIX — ' + brl(p.total) + '</button>' +
      '</div>';
  }

  function telaPix() {
    var r = estado.resposta;
    var qr = '<div class="bm-co-qr" id="bm-co-qr-canvas"></div>';

    return (r.testMode ? '<p class="bm-co-teste">Modo de teste — cobrança não criada.</p>' : '') +
      '<h2 class="bm-co-titulo">PIX gerado com sucesso</h2>' +
      '<p class="bm-co-valor">' + brl(r.amount) + '</p>' +
      qr +
      '<p class="bm-co-sub" style="text-align:center">Abra o app do banco, escolha PIX e leia o código.</p>' +
      '<div class="bm-co-copia">' +
        '<code id="bm-co-codigo">' + escapar(r.pix.copyPaste || '') + '</code>' +
        '<button type="button" class="bm-btn bm-btn--lg" id="bm-co-copiar">Copiar código PIX</button>' +
      '</div>' +
      '<p class="bm-co-aguardando" id="bm-co-aguardando"><span class="bm-co-pulso"></span> Aguardando pagamento…</p>' +
      '<p class="bm-co-sub" style="text-align:center">Após o pagamento, a confirmação acontece automaticamente.</p>' +
      '<p class="bm-co-ref">Pedido ' + escapar(r.externalRef) + '</p>';
  }

  function textoPostagem() {
    try {
      if (window.BODYMAN && window.BODYMAN.statusEnvio) {
        return window.BODYMAN.statusEnvio().noPrazo
          ? 'Pedidos com pagamento confirmado até às 12h em dias úteis são postados no mesmo dia.'
          : 'Seu pedido será postado em até 1 dia útil.';
      }
    } catch (e) {}
    return 'Pedidos com pagamento confirmado até às 12h em dias úteis são postados no mesmo dia.';
  }

  function telaConfirmado() {
    var r = estado.resposta, e = estado.endereco;
    return '<div class="bm-co-ok">' +
      '<div class="bm-co-selo" aria-hidden="true">✓</div>' +
      '<h2 class="bm-co-titulo">Pagamento confirmado</h2>' +
      '<p class="bm-co-sub">Pedido recebido com sucesso! Já estamos preparando seu pedido para envio.</p>' +
      '<p class="bm-co-ref">Número do pedido<br><strong>' + escapar(r.externalRef) + '</strong></p>' +
      '<ul class="bm-co-itens">' + resumoItens() + '</ul>' +
      '<p class="bm-co-entrega">' + escapar(e.street) + ', ' + escapar(e.number) + ' · ' +
        escapar(e.city) + '/' + escapar(e.state) + ' · ' + mascaraCEP(e.zipCode) + '</p>' +
      '<p class="bm-co-envio">' + textoPostagem() + '</p>' +
      '<button type="button" class="bm-btn bm-btn--lg" data-fechar>Fechar</button>' +
    '</div>';
  }

  /* ---------------- render ---------------- */
  function render() {
    var corpo = $('#bm-co-corpo');
    if (estado.passo === 'dados') corpo.innerHTML = telaDados();
    else if (estado.passo === 'endereco') corpo.innerHTML = telaEndereco();
    else if (estado.passo === 'resumo') corpo.innerHTML = telaResumo();
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
    if (input) input.classList.toggle('erro', Boolean(mensagem));
  }

  function limparErros() {
    Array.prototype.forEach.call(overlay.querySelectorAll('.bm-co-erro'), function (e) { e.textContent = ''; });
    Array.prototype.forEach.call(overlay.querySelectorAll('input.erro'), function (e) { e.classList.remove('erro'); });
  }

  /* ---------------- ligações de cada tela ---------------- */
  function ligarEventos() {
    var voltar = $('#bm-co-voltar');
    if (voltar) voltar.addEventListener('click', function () {
      estado.passo = estado.passo === 'resumo' ? 'endereco' : 'dados';
      render();
    });

    if (estado.passo === 'dados') ligarDados();
    if (estado.passo === 'endereco') ligarEndereco();
    if (estado.passo === 'resumo') ligarResumo();
    if (estado.passo === 'pix') ligarPix();
  }

  function ligarDados() {
    var tel = $('#bm-tel'), cpf = $('#bm-cpf');
    tel.addEventListener('input', function () { tel.value = mascaraTelefone(tel.value); });
    cpf.addEventListener('input', function () { cpf.value = mascaraCPF(cpf.value); });

    $('#bm-co-avancar').addEventListener('click', function () {
      limparErros();
      var d = {
        name: $('#bm-nome').value.trim(),
        email: $('#bm-email').value.trim(),
        phone: $('#bm-tel').value,
        cpf: $('#bm-cpf').value
      };
      var ok = true;
      if (!nomeOk(d.name)) { mostrarErro('bm-nome', 'Informe nome e sobrenome.'); ok = false; }
      if (!emailOk(d.email)) { mostrarErro('bm-email', 'E-mail inválido.'); ok = false; }
      if (!telefoneOk(d.phone)) { mostrarErro('bm-tel', 'Telefone inválido.'); ok = false; }
      if (!cpfOk(d.cpf)) { mostrarErro('bm-cpf', 'CPF inválido.'); ok = false; }
      if (!ok) return;

      estado.dados = d;
      guardar();
      estado.passo = 'endereco';
      render();
    });
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

    $('#bm-co-avancar').addEventListener('click', function () {
      limparErros();
      var e = {
        zipCode: digitos($('#bm-cep').value),
        street: $('#bm-rua').value.trim(),
        number: $('#bm-num').value.trim(),
        complement: $('#bm-compl').value.trim(),
        neighborhood: $('#bm-bairro').value.trim(),
        city: $('#bm-cidade').value.trim(),
        state: $('#bm-uf').value.trim().toUpperCase()
      };
      var ok = true;
      if (e.zipCode.length !== 8) { mostrarErro('bm-cep', 'CEP deve ter 8 números.'); ok = false; }
      if (e.street.length < 3) { mostrarErro('bm-rua', 'Informe a rua.'); ok = false; }
      if (!e.number) { mostrarErro('bm-num', 'Informe o número.'); ok = false; }
      if (e.neighborhood.length < 2) { mostrarErro('bm-bairro', 'Informe o bairro.'); ok = false; }
      if (e.city.length < 2) { mostrarErro('bm-cidade', 'Informe a cidade.'); ok = false; }
      if (e.state.length !== 2) { mostrarErro('bm-uf', 'UF inválida.'); ok = false; }
      if (!ok) return;

      estado.endereco = e;
      guardar();
      evento('add_shipping_info', { plan: estado.pedido.plan });
      estado.passo = 'resumo';
      render();
    });
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
        if (status) status.textContent = 'Endereço preenchido. Confira e complete o número.';
        var num = $('#bm-num');
        if (num && !num.value) num.focus();
      })
      .catch(function () { if (status) status.textContent = 'Não deu para buscar o CEP. Preencha manualmente.'; });
  }

  function ligarResumo() {
    $('#bm-co-pix').addEventListener('click', gerarPix);
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

    evento('generate_pix', { plan: estado.pedido.plan, value: estado.pedido.total / 100, currency: 'BRL' });

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
        if (!r.ok || !r.corpo.ok) throw new Error(r.corpo && r.corpo.error ? r.corpo.error : 'falha');
        estado.resposta = r.corpo;
        estado.passo = 'pix';
        render();
      })
      .catch(function (e) {
        var texto = e && e.message && e.message !== 'falha'
          ? e.message
          : 'Não conseguimos gerar o pagamento agora. Tente novamente em alguns instantes.';
        if (msg) msg.textContent = texto;
        botao.disabled = false;
        botao.textContent = 'Gerar PIX — ' + brl(estado.pedido.total);
      })
      .then(function () { estado.enviando = false; });
  }

  /* ---------------- tela do PIX ---------------- */
  function ligarPix() {
    var r = estado.resposta;

    montarQR(r);

    $('#bm-co-copiar').addEventListener('click', function () {
      var botao = this;
      var codigo = r.pix.copyPaste || '';
      copiar(codigo).then(function () {
        botao.textContent = 'PIX copiado!';
        setTimeout(function () { botao.textContent = 'Copiar código PIX'; }, 2500);
      });
    });

    iniciarPolling();
  }

  function copiar(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).catch(function () { return copiaAntiga(texto); });
    }
    return Promise.resolve(copiaAntiga(texto));
  }
  function copiaAntiga(texto) {
    var a = document.createElement('textarea');
    a.value = texto; a.setAttribute('readonly', '');
    a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(a);
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
    if (!alvo) return;
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
        alvo.innerHTML = '<p class="bm-co-sub">Use o código copia e cola abaixo.</p>';
      }
    }
    if (window.QRious) return renderizar();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
    s.onload = renderizar;
    s.onerror = function () { alvo.innerHTML = '<p class="bm-co-sub">Use o código copia e cola abaixo.</p>'; };
    document.head.appendChild(s);
  }

  /* ---------------- confirmação automática ---------------- */
  function iniciarPolling() {
    pararPolling();
    estado.pollInicio = Date.now();
    estado.poll = setTimeout(function ciclo() {
      consultarStatus().then(function (parar) {
        if (parar) return;
        if (Date.now() - estado.pollInicio > POLL_LIMITE) return;
        estado.poll = setTimeout(ciclo, POLL_INTERVALO);
      });
    }, POLL_PRIMEIRO);
  }

  function pararPolling() {
    if (estado.poll) { clearTimeout(estado.poll); estado.poll = null; }
  }

  function consultarStatus() {
    var r = estado.resposta;
    if (!r) return Promise.resolve(true);
    var url = API_STATUS + '?transactionId=' + encodeURIComponent(r.transactionId) +
              '&token=' + encodeURIComponent(r.token);
    return fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (d) {
        var s = d && d.status;
        if (s === 'PAID') { pagamentoConfirmado(); return true; }
        if (s === 'CANCELLED' || s === 'REFUNDED' || s === 'EXPIRED') {
          var el = $('#bm-co-aguardando');
          if (el) el.innerHTML = s === 'EXPIRED'
            ? 'Este PIX expirou. Gere um novo código para continuar.'
            : 'Este pagamento foi cancelado. Gere um novo PIX para continuar.';
          return true;
        }
        return false;
      })
      .catch(function () { return false; });
  }

  function pagamentoConfirmado() {
    pararPolling();
    var r = estado.resposta;
    // purchase só dispara com pagamento realmente confirmado
    evento('purchase', {
      value: r.amount / 100,
      currency: 'BRL',
      plan: estado.pedido.plan,
      products: estado.pedido.produtos,
      externalRef: r.externalRef,
      transaction_id: r.transactionId
    });
    estado.passo = 'confirmado';
    render();
  }

  /* ---------------- abrir e fechar ---------------- */
  function abrir(pedido) {
    if (!pedido || !pedido.completo) return;
    if (!overlay) criarOverlay();
    recuperar();

    estado.pedido = pedido;
    estado.resposta = null;
    estado.enviando = false;
    estado.passo = 'dados';
    estado.aberto = true;

    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    evento('begin_checkout', {
      plan: pedido.plan, products: pedido.produtos,
      value: pedido.total / 100, currency: 'BRL'
    });
    render();
    var primeiro = overlay.querySelector('input');
    if (primeiro && window.innerWidth > 820) primeiro.focus();
  }

  function fechar() {
    if (!estado.aberto) return;
    pararPolling();
    estado.aberto = false;
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------------- integração com a landing page ---------------- */
  capturarUTM();
  window.addEventListener('bodyman:checkout', function (e) { abrir(e.detail); });
  window.BodymanCheckout = { abrir: abrir, fechar: fechar };

  // view_offer uma vez por sessão
  window.addEventListener('load', function () {
    evento('view_offer', { currency: 'BRL' });
  });
})();
