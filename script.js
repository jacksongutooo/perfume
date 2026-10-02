(function () {
  'use strict';

  /* ================================================================
     CONFIGURAÇÃO — preços e regras exibidas na página.
     O valor cobrado é sempre o do servidor (api/_config.js): ao mudar
     um preço aqui, mude também lá.
     Os preços também estão escritos no index.html como reserva (para
     nunca aparecer campo vazio). O script reescreve tudo a partir daqui.
     ================================================================ */
  var CONFIG = {
    SINGLE_PRICE: 49.90,   // 1 frasco
    DOUBLE_PRICE: 79.90,   // 2 frascos
    TRIPLE_PRICE: 97.00,   // kit com 3

    /* Nota média exibida. null = calcula a partir das notas em avaliacoes.js */
    AVERAGE_RATING: 4.8,

    /* Vendas anteriores: só ligue SHOW_PREVIOUS_SALES se o número for real e comprovável. */
    PREVIOUS_SALES: 4000,
    SHOW_PREVIOUS_SALES: false,

    /* Barra fina do topo e selo da foto principal. Vazio = não aparece. */
    TOP_BAR_MESSAGE: 'Frete grátis para todo o Brasil · Envio com código de rastreio',
    OFFER_BADGE: 'Oferta de lançamento',

    /* ---- envio no mesmo dia ----
       Sábados, domingos e as datas de SAME_DAY_SHIPPING_HOLIDAYS não são dias úteis. */
    SAME_DAY_SHIPPING_ENABLED: true,
    SAME_DAY_SHIPPING_CUTOFF: '12:00',
    SAME_DAY_SHIPPING_TIMEZONE: 'America/Sao_Paulo',
    SAME_DAY_SHIPPING_HOLIDAYS: [],       // ex.: ['2026-11-20','2026-12-25','2027-01-01']
    SAME_DAY_SHIPPING_COUNTDOWN: true,    // mostra quanto falta para o horário de corte
    SHIPPING_DEFAULT_TEXT: 'em até 1 dia útil após o pagamento',

    /* O servidor não cobra frete em nenhuma opção (SHIPPING_AMOUNT = 0),
       então o frete grátis vale a partir de 1 frasco. */
    FREE_SHIPPING_MIN_ITEMS: 1,

    /* URL de um checkout externo. Vazio = usa o checkout PIX desta página. */
    CHECKOUT_URL: ''
  };

  /* ================================================================
     VEJA O BODYMAN DE PERTO — fotos reais do produto.
     PREENCHER: coloque a foto em img/de-perto/ e o caminho em "src".
     Espaço sem foto não aparece no site publicado (na pré-visualização
     aparece como quadro tracejado, para você ver onde a foto entra).
     ================================================================ */
  var FOTOS_DE_PERTO = [
    { titulo: 'Frasco na mão',              src: '', alt: 'Frasco Bodyman de 200 ml segurado na mão' },
    { titulo: 'As três fragrâncias juntas', src: '', alt: 'Os três frascos Bodyman lado a lado' },
    { titulo: 'Produto fora da caixa',      src: '', alt: 'Frascos Bodyman fora da caixa' },
    { titulo: 'Produto dentro da embalagem', src: '', alt: 'Frascos Bodyman dentro da embalagem de envio' },
    { titulo: 'Caixa pronta para envio',    src: '', alt: 'Caixa do pedido fechada e pronta para envio' },
    { titulo: 'Detalhes do frasco',         src: '', alt: 'Detalhe do rótulo e da válvula spray do frasco Bodyman' },
    { titulo: 'Tamanho real do produto',    src: '', alt: 'Frasco Bodyman ao lado de um objeto comum, para comparar o tamanho' }
  ];

  /* PREENCHER: foto real da embalagem, exibida em "Seu pedido chega assim". */
  var FOTO_EMBALAGEM = { src: '', alt: 'Embalagem real de um pedido Bodyman pronta para envio' };

  /* fragrâncias do kit, na ordem em que aparecem */
  var ORDEM = ['enigma', 'midtown', 'barbarius'];

  /* ================================================================
     utilidades
     ================================================================ */
  var FUNIL = window.BM_FUNIL || { evento: function () {}, definirOferta: function () {} };
  var SITE = window.BM_SITE || { preview: false };
  var PREVIEW = Boolean(SITE.preview);

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function each(sel, fn, ctx) {
    var lista = typeof sel === 'string' ? (ctx || document).querySelectorAll(sel) : sel;
    for (var i = 0; i < lista.length; i++) fn(lista[i], i);
  }
  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function brl(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }
  function texto(el, t) { if (el) el.textContent = t; }
  function rolarPara(el, bloco) {
    if (!el) return;
    var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { el.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: bloco || 'start' }); }
    catch (e) { el.scrollIntoView(true); }
  }

  /* ================================================================
     preços
     ================================================================ */
  var PRECO = { '1': CONFIG.SINGLE_PRICE, '2': CONFIG.DOUBLE_PRICE, 'kit': CONFIG.TRIPLE_PRICE };
  var MAPA = { single: '1', double: '2', triple: 'kit' };
  var PLANO_POR_OPCAO = { '1': 'single', '2': 'double', 'kit': 'triple' };

  function qtdDe(op) { return op === 'kit' ? 3 : parseInt(op, 10); }
  function precoDe(op) { return PRECO[op]; }
  function precoAvulso(op) { return CONFIG.SINGLE_PRICE * qtdDe(op); }
  function precoUnitario(op) { return PRECO[op] / qtdDe(op); }
  function economia(op) { return precoAvulso(op) - PRECO[op]; }
  var DIFERENCA_2_PARA_3 = CONFIG.TRIPLE_PRICE - CONFIG.DOUBLE_PRICE;

  function preencherValores() {
    each('[data-preco]', function (el) { el.textContent = brl(precoDe(MAPA[el.getAttribute('data-preco')])); });
    each('[data-unit]', function (el) { el.textContent = brl(precoUnitario(MAPA[el.getAttribute('data-unit')])); });
    each('[data-econ]', function (el) { el.textContent = brl(economia(MAPA[el.getAttribute('data-econ')])); });
    each('[data-de]', function (el) { el.textContent = brl(precoAvulso(MAPA[el.getAttribute('data-de')])); });
    each('[data-diff]', function (el) { el.textContent = brl(DIFERENCA_2_PARA_3); });
  }

  function preencherTopo() {
    var barra = document.getElementById('bm-topbar');
    if (barra) {
      if (CONFIG.TOP_BAR_MESSAGE) barra.textContent = CONFIG.TOP_BAR_MESSAGE;
      else barra.hidden = true;
    }
    var selo = document.getElementById('bm-selo-oferta');
    if (selo) {
      if (CONFIG.OFFER_BADGE) selo.textContent = CONFIG.OFFER_BADGE;
      else selo.hidden = true;
    }
    each('[data-vendas]', function (el) {
      if (CONFIG.SHOW_PREVIOUS_SALES && CONFIG.PREVIOUS_SALES > 0) {
        el.textContent = '· +' + CONFIG.PREVIOUS_SALES.toLocaleString('pt-BR') + ' vendas';
        el.hidden = false;
      }
    });
  }

  /* ================================================================
     envio no mesmo dia — horário calculado no fuso da operação
     ================================================================ */
  var DIAS_SEMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function agoraOperacao() {
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: CONFIG.SAME_DAY_SHIPPING_TIMEZONE, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', weekday: 'short'
      });
      var p = {};
      fmt.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      var hora = parseInt(p.hour, 10);
      if (p.dayPeriod) { hora = hora % 12; if (/pm/i.test(p.dayPeriod)) hora += 12; }
      if (hora === 24) hora = 0;
      var r = {
        ano: parseInt(p.year, 10), mes: parseInt(p.month, 10), dia: parseInt(p.day, 10),
        hora: hora, minuto: parseInt(p.minute, 10), semana: DIAS_SEMANA[p.weekday]
      };
      if (isNaN(r.ano + r.mes + r.dia + r.hora + r.minuto) || r.semana === undefined) throw new Error('data');
      return r;
    } catch (e) {
      /* sem Intl completo: o Brasil não tem horário de verão desde 2019 (São Paulo = UTC-3) */
      var d = new Date(Date.now() - 3 * 3600000);
      return {
        ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(),
        hora: d.getUTCHours(), minuto: d.getUTCMinutes(), semana: d.getUTCDay()
      };
    }
  }

  function minutosCorte() {
    var p = String(CONFIG.SAME_DAY_SHIPPING_CUTOFF || '12:00').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  function rotuloCorte() {
    var p = String(CONFIG.SAME_DAY_SHIPPING_CUTOFF || '12:00').split(':');
    var h = parseInt(p[0], 10) || 0, m = parseInt(p[1], 10) || 0;
    return m ? (h + 'h' + (m < 10 ? '0' + m : m)) : (h + 'h');
  }
  function doisDigitos(n) { return (n < 10 ? '0' : '') + n; }

  function statusEnvio() {
    var a = agoraOperacao();
    var iso = a.ano + '-' + doisDigitos(a.mes) + '-' + doisDigitos(a.dia);
    var diaUtil = a.semana >= 1 && a.semana <= 5 &&
      (CONFIG.SAME_DAY_SHIPPING_HOLIDAYS || []).indexOf(iso) === -1;
    var min = a.hora * 60 + a.minuto;
    var corte = minutosCorte();
    return {
      noPrazo: Boolean(CONFIG.SAME_DAY_SHIPPING_ENABLED) && diaUtil && min < corte,
      faltam: corte - min
    };
  }

  function textoFaltam(min) {
    if (min <= 0) return '';
    var h = Math.floor(min / 60), m = min % 60;
    if (h > 0) return 'faltam ' + h + 'h' + (m ? doisDigitos(m) : '');
    return (m === 1 ? 'falta ' : 'faltam ') + m + ' min';
  }

  /* frase curta: "pague até as 12h e postamos hoje — faltam 2h10" */
  function textoEnvioCurto() {
    var st = statusEnvio();
    if (!st.noPrazo) return CONFIG.SHIPPING_DEFAULT_TEXT;
    var resta = CONFIG.SAME_DAY_SHIPPING_COUNTDOWN ? textoFaltam(st.faltam) : '';
    return 'pague até as ' + rotuloCorte() + ' e postamos hoje' + (resta ? ' — ' + resta : '');
  }

  /* frase completa, usada também na confirmação do pedido */
  function textoEnvioPedido() {
    return statusEnvio().noPrazo
      ? 'Pagamento confirmado até as ' + rotuloCorte() + ' em dia útil: seu pedido é postado hoje.'
      : 'Seu pedido será postado ' + CONFIG.SHIPPING_DEFAULT_TEXT + '.';
  }

  function aplicarEnvio() {
    each('[data-corte]', function (el) { el.textContent = rotuloCorte(); });
    each('[data-envio-curto]', function (el) { el.textContent = textoEnvioCurto(); });
    each('[data-envio-etapa]', function (el) {
      el.textContent = CONFIG.SAME_DAY_SHIPPING_ENABLED
        ? 'Pagamentos até as ' + rotuloCorte() + ' em dias úteis são postados no mesmo dia; depois disso, ' + CONFIG.SHIPPING_DEFAULT_TEXT + '.'
        : 'Postagem ' + CONFIG.SHIPPING_DEFAULT_TEXT + '.';
    });
    if (!CONFIG.SAME_DAY_SHIPPING_ENABLED) {
      each('[data-regra-envio]', function (el) {
        el.textContent = 'A postagem acontece ' + CONFIG.SHIPPING_DEFAULT_TEXT + '. Sábados, domingos e feriados não contam como dia útil.';
      });
    }
  }

  /* ================================================================
     seletor de oferta
     ================================================================ */
  var estado = { opcao: 'kit', escolhas: [] };

  var elSeletor = document.getElementById('bm-seletor');
  var elEscolha = document.getElementById('bm-escolha');
  var elEscolhaTit = document.getElementById('bm-escolha-tit');
  var elUpsell = document.getElementById('bm-upsell');
  var elAviso = document.getElementById('bm-aviso');
  var elComprar = document.getElementById('bm-comprar');

  function quantidade() { return qtdDe(estado.opcao); }

  function pedidoAtual() {
    var itens = estado.opcao === 'kit' ? ORDEM.slice() : estado.escolhas.slice(0, quantidade());
    return {
      plan: PLANO_POR_OPCAO[estado.opcao],
      produtos: itens,
      frascos: quantidade(),
      volumeMl: quantidade() * 200,
      total: Math.round(precoDe(estado.opcao) * 100),   /* centavos (o servidor recalcula) */
      completo: itens.length === quantidade(),
      freteGratis: quantidade() >= CONFIG.FREE_SHIPPING_MIN_ITEMS
    };
  }

  var ROTULOS = {
    kit: { rotulo: 'Kit completo · 3 frascos · 600 ml', cta: 'Quero meu kit', sticky: 'Kit 3 frascos · frete grátis' },
    '2': { rotulo: '2 frascos · 400 ml', cta: 'Comprar agora', sticky: '2 frascos · frete grátis' },
    '1': { rotulo: '1 frasco · 200 ml', cta: 'Comprar agora', sticky: '1 frasco · frete grátis' }
  };

  function atualizarOferta() {
    var op = estado.opcao;
    var kit = op === 'kit';

    each('.bm-opcao[data-opcao]', function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-opcao') === op ? 'true' : 'false');
    });

    if (elEscolha) {
      elEscolha.hidden = kit;
      texto(elEscolhaTit, op === '1' ? 'Escolha a fragrância' : 'Escolha 2 fragrâncias diferentes');
      each('.bm-chip[data-fragrancia]', function (c) {
        c.setAttribute('aria-pressed', estado.escolhas.indexOf(c.getAttribute('data-fragrancia')) !== -1 ? 'true' : 'false');
      });
    }
    if (elUpsell) elUpsell.hidden = op !== '2';

    var frete = quantidade() >= CONFIG.FREE_SHIPPING_MIN_ITEMS ? ' · frete grátis' : '';
    texto($('[data-atual="rotulo"]'), ROTULOS[op].rotulo);
    texto($('[data-atual="preco"]'), brl(precoDe(op)));
    texto($('[data-atual="de"]'), brl(precoAvulso(op)));
    texto($('[data-atual="econ"]'), brl(economia(op)));
    texto($('[data-atual="unit"]'), brl(precoUnitario(op)));
    var linhaDe = $('[data-atual-linha="de"]'), linhaCada = $('[data-atual-linha="cada"]');
    if (linhaDe) linhaDe.hidden = op === '1';
    if (linhaCada) linhaCada.hidden = op === '1';

    texto(elComprar, ROTULOS[op].cta);
    texto($('[data-sticky-preco]'), brl(precoDe(op)));
    texto($('[data-sticky-desc]'), ROTULOS[op].sticky.replace(' · frete grátis', frete));
    texto($('[data-sticky-btn]'), ROTULOS[op].cta);

    if (pedidoAtual().completo) avisar('');
    FUNIL.definirOferta(PLANO_POR_OPCAO[op]);
  }

  function avisar(msg) {
    if (elAviso) elAviso.textContent = msg;
  }

  function selecionar(op, origem) {
    if (!PRECO.hasOwnProperty(op)) return;
    if (op !== estado.opcao) {
      estado.opcao = op;
      estado.escolhas = estado.escolhas.slice(0, op === 'kit' ? 0 : qtdDe(op));
      FUNIL.definirOferta(PLANO_POR_OPCAO[op]);
      FUNIL.evento('select_offer', { plan: PLANO_POR_OPCAO[op], value: precoDe(op), origem: origem || 'seletor' });
    }
    atualizarOferta();
  }

  function alternarFragrancia(chave) {
    if (estado.opcao === 'kit') return;
    var i = estado.escolhas.indexOf(chave);
    if (estado.opcao === '1') {
      estado.escolhas = [chave];
    } else if (i !== -1) {
      estado.escolhas.splice(i, 1);
    } else {
      if (estado.escolhas.length >= 2) estado.escolhas.shift();   // troca a mais antiga
      estado.escolhas.push(chave);
    }
    atualizarOferta();
  }

  function irParaSeletor() {
    rolarPara(elSeletor, 'center');
  }

  function pedirEscolha() {
    var faltam = quantidade() - pedidoAtual().produtos.length;
    avisar(faltam === 1 && quantidade() === 1 ? 'Escolha a fragrância para continuar.'
      : 'Escolha mais ' + faltam + ' fragrância' + (faltam > 1 ? 's' : '') + ' para continuar.');
    irParaSeletor();
    if (elEscolha) {
      elEscolha.classList.remove('bm-escolha--alerta');
      void elEscolha.offsetWidth;                       // reinicia a animação
      elEscolha.classList.add('bm-escolha--alerta');
    }
  }

  var ultimoClique = 0;
  function comprar(botao) {
    var agora = Date.now();
    if (agora - ultimoClique < 400) return;             // clique duplo
    ultimoClique = agora;

    var plano = botao.getAttribute('data-plano');
    var cta = botao.getAttribute('data-cta') || 'botao';
    if (plano) selecionar(plano, 'cta_' + cta);

    var pedido = pedidoAtual();
    FUNIL.evento('click_buy', {
      cta: cta, plan: pedido.plan, value: pedido.total / 100, products: pedido.produtos
    });

    if (!pedido.completo) { pedirEscolha(); return; }

    if (CONFIG.CHECKOUT_URL) { window.location.href = CONFIG.CHECKOUT_URL; return; }

    /* checkout.js escuta este evento e abre o fluxo do PIX */
    window.dispatchEvent(new CustomEvent('bodyman:checkout', { detail: pedido }));
    if (!window.BodymanCheckout) {
      avisar('Checkout indisponível no momento. Recarregue a página ou fale com a gente no WhatsApp.');
      if (window.console) console.error('[bodyman] checkout.js não carregou.');
    }
  }

  function ligarSeletor() {
    each('.bm-opcao[data-opcao]', function (b) {
      b.addEventListener('click', function () { selecionar(b.getAttribute('data-opcao'), 'seletor'); });
    });
    each('.bm-chip[data-fragrancia]', function (c) {
      c.addEventListener('click', function () { alternarFragrancia(c.getAttribute('data-fragrancia')); });
    });
    each('[data-plano-kit]', function (b) {
      b.addEventListener('click', function () { selecionar('kit', 'upsell'); });
    });
    each('[data-ir-seletor]', function (b) {
      b.addEventListener('click', irParaSeletor);
    });
    each('[data-escolher]', function (b) {
      b.addEventListener('click', function () {
        selecionar('1', 'fragrancia');
        estado.escolhas = [b.getAttribute('data-escolher')];
        atualizarOferta();
        irParaSeletor();
      });
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-comprar]') : null;
      if (b) comprar(b);
    });
  }

  /* ================================================================
     avaliações
     ================================================================ */
  var CORES_AVATAR = ['#4A6FA5', '#6B7B8C', '#3E7C64', '#9A6B4F', '#6E5E9C', '#2F6F8F'];

  function numeroOuNulo(v) {
    var n = Number(v);
    return v === null || v === undefined || v === '' || isNaN(n) ? null : Math.max(1, Math.min(5, n));
  }

  function normalizarAvaliacao(r) {
    var fotos = (r.fotos || r.photos || []).map(function (f) {
      return typeof f === 'string' ? { src: f, mini: f } : f;
    }).filter(function (f) { return f && f.src; });
    return {
      nome: String(r.nome || r.name || '').trim(),
      nota: numeroOuNulo(r.nota !== undefined ? r.nota : r.rating),
      texto: String(r.texto || r.text || '').trim(),
      data: String(r.data || r.date || '').trim(),
      produto: String(r.produto || r.product || '').trim(),
      idade: r.idade || r.age || null,
      fotos: fotos,
      fotoCliente: r.fotoCliente || r.customerPhoto || '',
      verificada: Boolean(r.verificada || r.verified),
      destaque: Boolean(r.destaque || r.featured),
      iniciais: r.iniciais || r.initials || ''
    };
  }

  var AVALIACOES = (window.BM_AVALIACOES || [])
    .map(normalizarAvaliacao)
    .filter(function (r) { return r.texto || r.fotos.length; });

  /* todas as fotos de clientes, na ordem da lista (usadas no visualizador) */
  var FOTOS_CLIENTES = [];
  AVALIACOES.forEach(function (r) {
    r.fotos.forEach(function (f) {
      f.indice = FOTOS_CLIENTES.length;
      FOTOS_CLIENTES.push({ src: f.src, mini: f.mini, w: f.w, h: f.h, legenda: (r.nome || 'Foto enviada por cliente') + (r.produto ? ' · ' + r.produto : '') });
    });
  });

  function notaMedia() {
    if (typeof CONFIG.AVERAGE_RATING === 'number') return CONFIG.AVERAGE_RATING;
    var notas = AVALIACOES.filter(function (r) { return r.nota; });
    if (!notas.length) return null;
    var soma = notas.reduce(function (s, r) { return s + r.nota; }, 0);
    return Math.round(soma / notas.length * 10) / 10;
  }

  function estrelas(nota) {
    return '<span class="bm-stars" role="img" aria-label="Nota ' + nota + ' de 5">★★★★★' +
      '<i style="width:' + (nota / 5 * 100) + '%">★★★★★</i></span>';
  }

  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  var ICONE_PESSOA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';

  function avatar(r, i) {
    if (r.fotoCliente) {
      return '<span class="bm-av-avatar"><img src="' + escapar(r.fotoCliente) + '" alt="" width="44" height="44" loading="lazy" decoding="async"></span>';
    }
    var ini = r.iniciais || r.nome.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (p) { return p.charAt(0); }).join('').toUpperCase();
    return '<span class="bm-av-avatar" style="background:' + CORES_AVATAR[i % CORES_AVATAR.length] + '" aria-hidden="true">' +
      (ini ? escapar(ini) : ICONE_PESSOA) + '</span>';
  }

  function botaoFoto(f, classe) {
    var w = f.w || 360, h = f.h || 480;
    return '<button type="button" class="' + classe + '" data-foto="' + f.indice + '" aria-label="Ampliar foto enviada por cliente">' +
      '<img src="' + escapar(f.mini || f.src) + '" alt="Foto do produto enviada por cliente" width="' + w + '" height="' + h + '" loading="lazy" decoding="async">' +
      '</button>';
  }

  function cardAvaliacao(r, i) {
    var meta = [r.idade ? r.idade + ' anos' : '', dataBR(r.data), r.produto].filter(Boolean).join(' · ');
    return '<article class="bm-av' + (r.texto ? '' : ' bm-av--so-foto') + '">' +
      '<div class="bm-av-topo">' + avatar(r, i) +
        '<div class="bm-av-quem"><p class="bm-av-nome">' + escapar(r.nome || 'Cliente') + '</p>' +
        (meta ? '<p class="bm-av-meta">' + escapar(meta) + '</p>' : '') + '</div>' +
        (r.verificada ? '<span class="bm-av-verif">Compra verificada</span>' : '') +
      '</div>' +
      (r.nota ? estrelas(r.nota) : '') +
      (r.texto ? '<p class="bm-av-texto">' + escapar(r.texto) + '</p>' : '') +
      (r.fotos.length ? '<div class="bm-av-fotos">' + r.fotos.map(function (f) { return botaoFoto(f, 'bm-av-foto'); }).join('') + '</div>' : '') +
      (!r.texto && r.fotos.length ? '<p class="bm-av-legenda">Foto enviada por cliente</p>' : '') +
    '</article>';
  }

  function cardDestaque(r) {
    var foto = r.fotos[0];
    var soFoto = foto && !r.nome && !r.texto && !r.nota;
    return '<article class="bm-dest' + (foto ? '' : ' bm-dest--texto') + (soFoto ? ' bm-dest--so-foto' : '') + '">' +
      (foto ? botaoFoto(foto, 'bm-dest-foto') : '') +
      (soFoto ? '' :
        '<div class="bm-dest-info">' +
          (r.nota ? estrelas(r.nota) : '') +
          (r.nome || !foto ? '<p class="bm-dest-nome">' + escapar(r.nome || 'Cliente') + (r.verificada ? ' <span class="bm-av-verif">Verificada</span>' : '') + '</p>' : '') +
          '<p class="bm-dest-texto">' + escapar(r.texto || 'Foto enviada por cliente') + '</p>' +
        '</div>') +
    '</article>';
  }

  var filtroAtual = 'todas';
  var limite = 6;
  var POR_PAGINA = 6;

  function filtrar(f) {
    return AVALIACOES.filter(function (r) {
      if (f === 'fotos') return r.fotos.length > 0;
      if (f === '5' || f === '4' || f === '3' || f === '2' || f === '1') return r.nota !== null && Math.round(r.nota) === Number(f);
      return true;
    });
  }

  /* Na aba "Todas", fotos sem comentário já aparecem na faixa "Fotos de
     clientes" logo acima, então a lista mostra só quem escreveu algo. */
  function listaParaExibir(f) {
    var lista = filtrar(f);
    if (f === 'todas' && FOTOS_CLIENTES.length) {
      var comTexto = lista.filter(function (r) { return r.texto; });
      if (comTexto.length) return comTexto;
    }
    return lista;
  }

  function renderMidia() {
    var caixa = document.getElementById('bm-av-midia');
    var trilho = document.getElementById('bm-av-midia-trilho');
    if (!caixa || !trilho || !FOTOS_CLIENTES.length) return;
    trilho.innerHTML = FOTOS_CLIENTES.map(function (f, i) {
      return '<button type="button" class="bm-av-midia-foto" data-foto="' + i + '" aria-label="Ampliar foto ' + (i + 1) + ' de cliente">' +
        '<img src="' + escapar(f.mini || f.src) + '" alt="Foto do produto enviada por cliente" width="' + (f.w || 360) + '" height="' + (f.h || 480) + '" loading="lazy" decoding="async"></button>';
    }).join('');
    texto(document.getElementById('bm-av-midia-qtd'), '(' + FOTOS_CLIENTES.length + ')');
    caixa.hidden = false;
  }

  function renderLista() {
    var lista = listaParaExibir(filtroAtual);
    var el = document.getElementById('bm-av-lista');
    var mais = document.getElementById('bm-av-mais');
    if (!el) return;
    el.innerHTML = lista.slice(0, limite).map(cardAvaliacao).join('') ||
      '<p class="bm-av-vazio">Nenhuma avaliação neste filtro.</p>';
    if (mais) {
      var restantes = lista.length - limite;
      mais.hidden = restantes <= 0;
      mais.textContent = 'Ver mais avaliações (' + Math.max(restantes, 0) + ')';
    }
  }

  function renderAvaliacoes() {
    var secao = document.getElementById('avaliacoes');
    var media = notaMedia();

    if (!AVALIACOES.length) {
      /* sem avaliações, sem nota nem bloco de prova social */
      each('.bm-nota, .bm-prova', function (el) { el.hidden = true; });
      return;
    }

    each('[data-nota]', function (el) { el.textContent = media ? media.toFixed(1).replace('.', ',') : ''; });
    each('[data-estrelas]', function (el) { el.style.width = (media ? media / 5 * 100 : 0) + '%'; });
    if (!media) each('.bm-nota .bm-stars, .bm-prova-nota .bm-stars, .bm-av-media .bm-stars', function (el) { el.hidden = true; });

    /* destaques logo abaixo da oferta (até 3) */
    var destaques = AVALIACOES.filter(function (r) { return r.destaque; });
    if (!destaques.length) destaques = AVALIACOES.filter(function (r) { return r.fotos.length; });
    if (!destaques.length) destaques = AVALIACOES.slice();
    var elDest = document.getElementById('bm-destaques');
    if (elDest) {
      destaques = destaques.slice(0, 3);
      elDest.innerHTML = destaques.map(cardDestaque).join('');
      var soFotos = destaques.every(function (r) { return r.fotos.length && !r.nome && !r.texto && !r.nota; });
      var legenda = document.getElementById('bm-destaques-legenda');
      if (legenda) legenda.hidden = !soFotos;
    }

    if (!secao) return;
    secao.hidden = false;

    var comNota = AVALIACOES.filter(function (r) { return r.nota; });
    var comFoto = AVALIACOES.filter(function (r) { return r.fotos.length; });
    var base = [];
    if (comNota.length) base.push(comNota.length + (comNota.length === 1 ? ' avaliação com nota' : ' avaliações com nota'));
    if (comFoto.length) base.push(comFoto.length + (comFoto.length === 1 ? ' foto de cliente' : ' fotos de clientes'));
    texto(document.getElementById('bm-av-base'), base.join(' · '));

    var barras = document.getElementById('bm-av-barras');
    if (barras) {
      var html = '';
      for (var n = 5; n >= 1; n--) {
        var qtd = filtrar(String(n)).length;
        var pct = comNota.length ? Math.round(qtd / comNota.length * 100) : 0;
        html += '<div class="bm-av-barra"><span>' + n + ' ★</span>' +
          '<span class="bm-av-trilho"><i style="width:' + pct + '%"></i></span><span>' + qtd + '</span></div>';
      }
      barras.innerHTML = html;
      barras.hidden = !comNota.length;
    }

    each('.bm-filtro[data-filtro]', function (b) {
      var f = b.getAttribute('data-filtro');
      var qtd = filtrar(f).length;
      if (f !== 'todas' && !qtd) { b.hidden = true; return; }
      b.innerHTML = escapar(b.textContent.replace(/\s*\(\d+\)$/, '')) + ' <span>(' + qtd + ')</span>';
      b.addEventListener('click', function () {
        filtroAtual = f;
        limite = POR_PAGINA;
        each('.bm-filtro[data-filtro]', function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        renderLista();
      });
    });

    var mais = document.getElementById('bm-av-mais');
    if (mais) mais.addEventListener('click', function () { limite += POR_PAGINA; renderLista(); });

    renderMidia();
    renderLista();
  }

  /* ================================================================
     visualizador de fotos (toque para ampliar, deslize para trocar)
     ================================================================ */
  var lb = null, lbLista = [], lbIndice = 0, lbFoco = null;

  function criarLightbox() {
    lb = document.createElement('div');
    lb.className = 'bm-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Foto ampliada');
    lb.hidden = true;
    lb.innerHTML =
      '<button type="button" class="bm-lb-x" data-lb="fechar" aria-label="Fechar">&times;</button>' +
      '<button type="button" class="bm-lb-seta bm-lb-seta--ant" data-lb="-1" aria-label="Foto anterior">&#8249;</button>' +
      '<figure class="bm-lb-fig"><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="bm-lb-seta bm-lb-seta--prox" data-lb="1" aria-label="Próxima foto">&#8250;</button>';
    document.body.appendChild(lb);

    lb.addEventListener('click', function (e) {
      var acao = e.target.getAttribute && e.target.getAttribute('data-lb');
      if (acao === 'fechar' || e.target === lb) fecharLightbox();
      else if (acao) mostrarFoto(lbIndice + Number(acao));
    });
    document.addEventListener('keydown', function (e) {
      if (!lb || lb.hidden) return;
      if (e.key === 'Escape') fecharLightbox();
      else if (e.key === 'ArrowRight') mostrarFoto(lbIndice + 1);
      else if (e.key === 'ArrowLeft') mostrarFoto(lbIndice - 1);
    });
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 45) mostrarFoto(lbIndice + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  function mostrarFoto(i) {
    if (!lbLista.length) return;
    lbIndice = (i + lbLista.length) % lbLista.length;
    var f = lbLista[lbIndice];
    var img = lb.querySelector('img');
    img.src = f.src;
    img.alt = f.alt || f.legenda || 'Foto do produto';
    lb.querySelector('figcaption').textContent = f.legenda + (lbLista.length > 1 ? '  ·  ' + (lbIndice + 1) + '/' + lbLista.length : '');
    each('.bm-lb-seta', function (s) { s.hidden = lbLista.length < 2; }, lb);
  }

  function abrirLightbox(lista, i) {
    if (!lista.length) return;
    if (!lb) criarLightbox();
    lbFoco = document.activeElement;
    lbLista = lista;
    lb.hidden = false;
    document.documentElement.classList.add('bm-travado');
    mostrarFoto(i || 0);
    var x = lb.querySelector('.bm-lb-x');
    if (x) x.focus();
  }

  function fecharLightbox() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    document.documentElement.classList.remove('bm-travado');
    if (lbFoco && lbFoco.focus) lbFoco.focus();
  }

  function ligarFotosClientes() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-foto]') : null;
      if (!b) return;
      abrirLightbox(FOTOS_CLIENTES, Number(b.getAttribute('data-foto')));
    });
  }

  /* ================================================================
     carrossel "Veja de perto" + foto da embalagem
     ================================================================ */
  var ICONE_CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  function montarDePerto() {
    var secao = document.getElementById('fotos');
    var trilho = document.getElementById('bm-perto-trilho');
    var dots = document.getElementById('bm-perto-dots');
    if (!secao || !trilho) return;

    var reais = FOTOS_DE_PERTO.filter(function (f) { return f.src; });
    var slots = PREVIEW ? FOTOS_DE_PERTO : reais;
    if (!slots.length) return;                 /* nada para mostrar: a seção continua oculta */

    var visor = reais.map(function (f) { return { src: f.src, legenda: f.titulo, alt: f.alt }; });
    var posReal = 0;
    trilho.innerHTML = slots.map(function (f) {
      if (f.src) {
        var i = posReal++;
        return '<li class="bm-car-slide"><button type="button" class="bm-car-foto" data-perto="' + i + '" aria-label="Ampliar: ' + escapar(f.titulo) + '">' +
          '<img src="' + escapar(f.src) + '" alt="' + escapar(f.alt || f.titulo) + '" loading="lazy" decoding="async"></button>' +
          '<p class="bm-car-legenda">' + escapar(f.titulo) + '</p></li>';
      }
      return '<li class="bm-car-slide"><div class="bm-car-vazio">' + ICONE_CAMERA +
        '<b>' + escapar(f.titulo) + '</b><span>Espaço para foto real — preencha FOTOS_DE_PERTO no script.js</span></div></li>';
    }).join('');
    secao.hidden = false;

    trilho.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-perto]') : null;
      if (b) abrirLightbox(visor, Number(b.getAttribute('data-perto')));
    });

    var slides = trilho.children;
    if (dots) {
      var h = '';
      for (var i = 0; i < slides.length; i++) h += '<button type="button" class="bm-car-dot" data-ir="' + i + '" aria-label="Foto ' + (i + 1) + '"></button>';
      dots.innerHTML = h;
    }

    function passo() { return slides[0] ? slides[0].getBoundingClientRect().width : trilho.clientWidth; }
    function indiceAtual() { return Math.round(trilho.scrollLeft / Math.max(passo(), 1)); }
    function marcar() {
      var atual = indiceAtual();
      each('.bm-car-dot', function (d, i) { d.setAttribute('aria-current', i === atual ? 'true' : 'false'); }, dots);
    }
    function irPara(i) {
      var alvo = Math.max(0, Math.min(slides.length - 1, i));
      var left = slides[alvo].offsetLeft - trilho.offsetLeft;
      try { trilho.scrollTo({ left: left, behavior: 'smooth' }); } catch (e) { trilho.scrollLeft = left; }
    }

    each('[data-car]', function (b) {
      b.addEventListener('click', function () { irPara(indiceAtual() + Number(b.getAttribute('data-car'))); });
    }, secao);
    if (dots) dots.addEventListener('click', function (e) {
      var d = e.target.closest ? e.target.closest('[data-ir]') : null;
      if (d) irPara(Number(d.getAttribute('data-ir')));
    });
    var pendente = false;
    trilho.addEventListener('scroll', function () {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(function () { pendente = false; marcar(); });
    }, { passive: true });
    marcar();
    var nav = secao.querySelector('.bm-car-nav');
    if (nav) nav.hidden = slides.length < 2;
  }

  function montarEmbalagem() {
    var fig = document.getElementById('bm-embalagem');
    if (!fig) return;
    if (FOTO_EMBALAGEM.src) {
      fig.innerHTML = '<img src="' + escapar(FOTO_EMBALAGEM.src) + '" alt="' + escapar(FOTO_EMBALAGEM.alt) + '" loading="lazy" decoding="async">' +
        '<figcaption>Foto real da embalagem de um pedido</figcaption>';
      fig.hidden = false;
    } else if (PREVIEW) {
      fig.innerHTML = '<div class="bm-car-vazio">' + ICONE_CAMERA + '<b>Foto real da embalagem</b>' +
        '<span>Preencha FOTO_EMBALAGEM no script.js</span></div>';
      fig.hidden = false;
    }
  }

  /* ================================================================
     barra fixa de compra (celular): aparece quando nenhum botão de
     compra está na tela e some com o checkout ou o visualizador abertos
     ================================================================ */
  function ligarBarraFixa() {
    var barra = document.getElementById('bm-sticky');
    if (!barra) return;
    var alvos = [];
    each('[data-comprar]', function (b) { if (!b.hasAttribute('data-sticky-btn')) alvos.push(b); });
    var visiveis = 0;

    function aplicar() {
      var mostrar = visiveis === 0;
      barra.setAttribute('data-visivel', mostrar ? 'true' : 'false');
      document.documentElement.classList.toggle('bm-com-barra', mostrar);
      /* no desktop, o balão do WhatsApp se recolhe para não cobrir um botão de compra */
      document.documentElement.classList.toggle('bm-cta-visivel', !mostrar);
    }

    if ('IntersectionObserver' in window) {
      var estados = [];
      var obs = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (en) {
          var i = alvos.indexOf(en.target);
          if (i !== -1) estados[i] = en.isIntersecting && en.target.offsetParent !== null;
        });
        visiveis = estados.filter(Boolean).length;
        aplicar();
      }, { threshold: 0.4 });
      alvos.forEach(function (a, i) { estados[i] = false; obs.observe(a); });
    } else {
      var checar = function () {
        visiveis = alvos.filter(function (a) {
          var r = a.getBoundingClientRect();
          return r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
        }).length;
        aplicar();
      };
      window.addEventListener('scroll', checar, { passive: true });
      window.addEventListener('resize', checar);
      checar();
    }
  }

  /* ================================================================
     início — cada etapa isolada: um erro não impede as outras
     ================================================================ */
  function etapa(fn) {
    try { fn(); } catch (e) { if (window.console) console.error('[bodyman]', e); }
  }

  etapa(preencherValores);
  etapa(preencherTopo);
  etapa(aplicarEnvio);
  etapa(ligarSeletor);
  etapa(atualizarOferta);
  etapa(renderAvaliacoes);
  etapa(ligarFotosClientes);
  etapa(montarDePerto);
  etapa(montarEmbalagem);
  etapa(ligarBarraFixa);
  setInterval(function () { etapa(aplicarEnvio); }, 60000);   /* mantém o horário de corte correto */

  /* superfície pública usada pelo checkout.js */
  window.BODYMAN = {
    pedidoAtual: pedidoAtual,
    statusEnvio: statusEnvio,
    textoEnvioPedido: textoEnvioPedido,
    brl: brl,
    selecionar: selecionar,
    irParaSeletor: irParaSeletor,
    config: CONFIG
  };

  etapa(function () {
    var p = pedidoAtual();
    FUNIL.evento('view_product', { plan: p.plan, value: p.total / 100, products: p.produtos }, { unico: 'view_product' });
  });
})();
