/* =====================================================================
   BODYMAN — configuração e funções compartilhadas por todas as páginas:
   contato, dados da empresa, menu, botão de WhatsApp e eventos do funil.

   Tudo que você precisa preencher está no objeto SITE logo abaixo.
   Campos vazios simplesmente não aparecem no site publicado. Em modo de
   pré-visualização (localhost, *.vercel.app ou ?preview=1 na URL) eles
   aparecem destacados em amarelo, para você saber o que falta.
   ===================================================================== */
(function () {
  'use strict';

  var SITE = {
    /* ---------- atendimento ---------- */
    WHATSAPP_NUMERO: '5516995417328',
    WHATSAPP_EXIBICAO: '(16) 99541-7328',
    WHATSAPP_MENSAGEM: 'Olá! Vim pelo site da Bodyman e gostaria de tirar uma dúvida sobre meu pedido/produtos.',

    /* PREENCHER: horário real do atendimento. Ex.: 'Segunda a sexta, das 9h às 18h' */
    ATENDIMENTO_HORARIO: '',

    /* PREENCHER somente se existir um e-mail real de atendimento. */
    EMAIL: '',

    /* ---------- dados da empresa ----------
       PREENCHER: lojas on-line precisam exibir razão social, CNPJ e
       endereço (Decreto 7.962/2013). Aparecem no rodapé e nas políticas. */
    EMPRESA: {
      NOME: 'Ideal Store',
      RAZAO_SOCIAL: '',
      CNPJ: '',
      ENDERECO: ''
    },

    /* ---------- rastreio ----------
       PREENCHER (opcional): nome da transportadora e o link de rastreio
       dela, com {codigo} no lugar do código. Com isso, a página
       "Rastrear pedido" ganha o campo para o cliente rastrear sozinho. */
    RASTREIO_TRANSPORTADORA: '',
    RASTREIO_URL: ''
  };

  /* ================================================================
     utilidades
     ================================================================ */
  function each(sel, fn, ctx) {
    var lista = typeof sel === 'string' ? (ctx || document).querySelectorAll(sel) : sel;
    for (var i = 0; i < lista.length; i++) fn(lista[i], i);
  }
  function assign(alvo) {
    for (var i = 1; i < arguments.length; i++) {
      var o = arguments[i];
      if (!o) continue;
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) alvo[k] = o[k];
    }
    return alvo;
  }
  function lerStorage(tipo, chave) {
    try { return window[tipo].getItem(chave); } catch (e) { return null; }
  }
  function gravarStorage(tipo, chave, valor) {
    try { window[tipo].setItem(chave, valor); } catch (e) {}
  }
  function lerJSON(tipo, chave) {
    try { return JSON.parse(lerStorage(tipo, chave) || 'null'); } catch (e) { return null; }
  }
  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var host = location.hostname || '';
  var PREVIEW = location.protocol === 'file:' ||
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(host) ||
    /\.vercel\.app$/i.test(host) ||
    /[?&]preview=1(&|$)/.test(location.search);
  if (PREVIEW) document.documentElement.className += ' bm-preview';

  function linkWhats(mensagem) {
    return 'https://wa.me/' + SITE.WHATSAPP_NUMERO + '?text=' +
      encodeURIComponent(mensagem || SITE.WHATSAPP_MENSAGEM);
  }

  /* ================================================================
     FUNIL — eventos padronizados com contexto de dispositivo e origem.

     Vão para: dataLayer (GTM/GA4), Meta Pixel (fbq) e gtag, se existir.
     Eventos: page_view, view_product, click_buy, select_offer,
     begin_checkout, add_contact_info, add_shipping_info, pix_generated,
     purchase (+ auxiliares: checkout_step, checkout_close, pix_error,
     pix_copied, whatsapp_click).
     Para ver no console: ?debug_funil=1 na URL.
     ================================================================ */
  var CAMPOS_UTM = ['source', 'medium', 'campaign', 'content', 'term'];

  /* Mesmo formato que o checkout envia para o servidor: { source, medium, ... } */
  function capturarUTM() {
    var salvas = lerJSON('sessionStorage', 'bm_utm') || {};
    var mudou = false;
    var params = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (par) {
      if (!par) return;
      var i = par.indexOf('=');
      var k = decodeURIComponentSeguro(i === -1 ? par : par.slice(0, i));
      params[k] = decodeURIComponentSeguro(i === -1 ? '' : par.slice(i + 1).replace(/\+/g, ' '));
    });
    CAMPOS_UTM.forEach(function (c) {
      var v = params['utm_' + c];
      if (v) { salvas[c] = String(v).slice(0, 120); mudou = true; }
    });
    if (mudou) gravarStorage('sessionStorage', 'bm_utm', JSON.stringify(salvas));
    return { utm: salvas, params: params };
  }
  function decodeURIComponentSeguro(v) {
    try { return decodeURIComponent(v); } catch (e) { return v; }
  }

  function dispositivo() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ||
        (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
    if (/Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
    return 'desktop';
  }
  function navegadorApp() {
    var ua = navigator.userAgent || '';
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return 'facebook';
    if (/musical_ly|TikTok|BytedanceWebview|trill/i.test(ua)) return 'tiktok';
    if (/WhatsApp/i.test(ua)) return 'whatsapp';
    if (/GSA\//i.test(ua)) return 'google_app';
    return 'navegador';
  }
  function sistema() {
    var ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh/i.test(ua)) return 'mac';
    return 'outro';
  }
  function origemDaVisita(utm, params) {
    if (utm.source) return String(utm.source).toLowerCase();
    if (params.fbclid) return 'facebook';
    if (params.gclid || params.gbraid || params.wbraid) return 'google';
    if (params.ttclid) return 'tiktok';
    var ref = document.referrer;
    if (!ref) return 'direto';
    var h = '';
    try { h = new URL(ref).hostname.replace(/^www\./, ''); } catch (e) { return 'outro'; }
    if (h === location.hostname.replace(/^www\./, '')) return 'interno';
    if (/instagram\./.test(h)) return 'instagram';
    if (/facebook\.|fb\.com|fb\.me/.test(h)) return 'facebook';
    if (/google\./.test(h)) return 'google';
    if (/tiktok\./.test(h)) return 'tiktok';
    if (/whatsapp|wa\.me/.test(h)) return 'whatsapp';
    if (/youtube\./.test(h)) return 'youtube';
    return h;
  }

  var capt = capturarUTM();
  /* origem da primeira página da sessão (navegar entre páginas não muda) */
  var sessao = lerJSON('sessionStorage', 'bm_origem');
  if (!sessao) {
    sessao = { origem: origemDaVisita(capt.utm, capt.params), entrada: location.pathname };
    gravarStorage('sessionStorage', 'bm_origem', JSON.stringify(sessao));
  } else if (capt.utm.source && sessao.origem !== String(capt.utm.source).toLowerCase()) {
    sessao.origem = String(capt.utm.source).toLowerCase();       // nova campanha na mesma aba
    gravarStorage('sessionStorage', 'bm_origem', JSON.stringify(sessao));
  }

  var CONTEXTO_FIXO = {
    device_type: dispositivo(),
    browser_app: navegadorApp(),
    os: sistema()
  };
  var ofertaAtual = 'triple';
  var historico = [];
  var unicos = {};
  var DEBUG = /[?&]debug_funil=1(&|$)/.test(location.search) || lerStorage('localStorage', 'bm_debug_funil') === '1';

  function contexto() {
    var utm = lerJSON('sessionStorage', 'bm_utm') || capt.utm || {};
    return assign({}, CONTEXTO_FIXO, {
      traffic_source: sessao.origem,
      utm_source: utm.source || '',
      utm_medium: utm.medium || '',
      utm_campaign: utm.campaign || '',
      utm_content: utm.content || '',
      utm_term: utm.term || '',
      offer: ofertaAtual,
      page: location.pathname
    });
  }

  /* Meta Pixel: só eventos com significado claro; o PageView já sai no <head>. */
  var META = {
    view_product: ['track', 'ViewContent'],
    click_buy: ['trackCustom', 'ClickBuy'],
    select_offer: ['trackCustom', 'SelectOffer'],
    begin_checkout: ['track', 'InitiateCheckout'],
    add_shipping_info: ['trackCustom', 'AddShippingInfo'],
    pix_generated: ['track', 'AddPaymentInfo'],
    purchase: ['track', 'Purchase'],
    whatsapp_click: ['track', 'Contact']
  };

  function enviarMeta(nome, p) {
    var m = META[nome];
    if (!m || typeof window.fbq !== 'function') return;
    var props = { currency: 'BRL', content_type: 'product' };
    if (p.value != null) props.value = p.value;
    if (p.products && p.products.length) { props.content_ids = p.products; props.num_items = p.products.length; }
    if (p.plan) props.content_name = p.plan;
    /* contexto sem dados pessoais, para segmentar no Gerenciador de Eventos */
    props.device_type = p.device_type;
    props.traffic_source = p.traffic_source;
    if (p.cta) props.cta = p.cta;
    try {
      /* externalRef como eventID evita contagem dupla se um dia entrar a API de conversões */
      if (p.externalRef) window.fbq(m[0], m[1], props, { eventID: p.externalRef });
      else window.fbq(m[0], m[1], props);
    } catch (e) {}
  }

  /* gtag (GA4), se for instalado um dia. page_view o próprio GA4 já envia. */
  var GA = {
    view_product: 'view_item', select_offer: 'select_item', begin_checkout: 'begin_checkout',
    add_shipping_info: 'add_shipping_info', pix_generated: 'add_payment_info', purchase: 'purchase'
  };
  function enviarGtag(nome, p) {
    if (typeof window.gtag !== 'function' || nome === 'page_view') return;
    var params = {
      currency: 'BRL', value: p.value, plan: p.plan, cta: p.cta,
      device_type: p.device_type, browser_app: p.browser_app, traffic_source: p.traffic_source
    };
    if (nome === 'purchase') params.transaction_id = p.externalRef;
    if (p.products) params.items = p.products.map(function (s) { return { item_id: s, item_name: 'Bodyman ' + s }; });
    try { window.gtag('event', GA[nome] || nome, params); } catch (e) {}
  }

  /**
   * Registra um evento do funil.
   * opcoes.unico: chave que impede o mesmo evento de sair duas vezes na página.
   */
  function evento(nome, dados, opcoes) {
    if (opcoes && opcoes.unico) {
      if (unicos[opcoes.unico]) return false;
      unicos[opcoes.unico] = true;
    }
    var payload = assign({ event: nome }, contexto(), dados || {});
    historico.push(payload);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    try { window.dispatchEvent(new CustomEvent('bodyman:' + nome, { detail: payload })); } catch (e) {}
    enviarMeta(nome, payload);
    enviarGtag(nome, payload);
    if (DEBUG && window.console) console.info('[funil]', nome, payload);
    return true;
  }

  window.BM_SITE = SITE;
  window.BM_SITE.preview = PREVIEW;
  window.BM_SITE.linkWhats = linkWhats;
  window.BM_UTIL = { each: each, assign: assign, escapar: escapar, lerJSON: lerJSON, lerStorage: lerStorage, gravarStorage: gravarStorage };
  window.BM_FUNIL = {
    evento: evento,
    contexto: contexto,
    definirOferta: function (plano) { if (plano) ofertaAtual = plano; },
    historico: historico,
    utm: function () { return lerJSON('sessionStorage', 'bm_utm') || {}; }
  };

  /* ================================================================
     interface comum
     ================================================================ */
  function marcarPendente(el, texto) {
    el.innerHTML = '<mark class="bm-preencher">' + escapar(texto) + '</mark>';
    el.hidden = false;
  }

  function preencherContato() {
    each('[data-whats]', function (a) { a.href = linkWhats(a.getAttribute('data-whats-msg')); });
    /* qualquer link de WhatsApp, inclusive os criados depois (checkout) */
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="https://wa.me/"]') : null;
      if (!a) return;
      var secao = a.closest('[id]');
      var local = a.getAttribute('data-whats-local') ||
        (a.classList.contains('bm-whats') ? 'botao_flutuante' :
          (a.closest('.bm-co') ? 'checkout_' + ((window.BodymanCheckout && window.BodymanCheckout.passo && window.BodymanCheckout.passo()) || '') :
            (secao ? secao.id : 'pagina')));
      evento('whatsapp_click', { local: local });
    });
    each('[data-whats-numero]', function (el) { el.textContent = SITE.WHATSAPP_EXIBICAO; });

    each('[data-horario]', function (el) {
      if (SITE.ATENDIMENTO_HORARIO) { el.textContent = 'Horário: ' + SITE.ATENDIMENTO_HORARIO + '.'; el.hidden = false; }
      else if (PREVIEW) marcarPendente(el, 'Horário de atendimento: preencher em site.js (ATENDIMENTO_HORARIO)');
    });
    each('[data-email]', function (el) {
      if (SITE.EMAIL) {
        el.innerHTML = 'E-mail: <a href="mailto:' + escapar(SITE.EMAIL) + '">' + escapar(SITE.EMAIL) + '</a>';
        el.hidden = false;
      } else if (PREVIEW) marcarPendente(el, 'E-mail: preencher em site.js (EMAIL), só se existir');
    });
    each('[data-empresa-campo]', function (el) {
      var campo = el.getAttribute('data-empresa-campo');
      var rotulo = el.getAttribute('data-rotulo') || campo;
      var valor = SITE.EMPRESA[campo];
      if (valor) { el.textContent = rotulo + ': ' + valor; el.hidden = false; }
      else if (PREVIEW) marcarPendente(el, rotulo + ': preencher em site.js (EMPRESA.' + campo + ')');
    });
    each('[data-ano]', function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  function ligarMenu() {
    var botao = document.querySelector('.bm-menu-btn');
    var nav = document.getElementById('bm-nav');
    if (!botao || !nav) return;

    function definir(abrir) {
      botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      nav.setAttribute('data-aberto', abrir ? 'true' : 'false');
    }
    botao.addEventListener('click', function () {
      definir(botao.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) definir(false);
    });
    document.addEventListener('click', function (e) {
      if (botao.getAttribute('aria-expanded') === 'true' && e.target.closest && !e.target.closest('.bm-header')) definir(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && botao.getAttribute('aria-expanded') === 'true') { definir(false); botao.focus(); }
    });
  }

  /* Rolagem para âncoras da própria página. Feita em JS para funcionar
     mesmo que algum script de UTM acrescente parâmetros aos links. */
  function rolarPara(alvo) {
    if (!alvo) return;
    var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' }); }
    catch (e) { alvo.scrollIntoView(true); }
  }
  window.BM_SITE.rolarPara = rolarPara;

  function normalizarCaminho(p) { return String(p || '/').replace(/index\.html$/, ''); }

  function ligarAncoras() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var a = e.target.closest ? e.target.closest('a[href*="#"]') : null;
      if (!a || a.target === '_blank') return;
      var hash = a.hash;
      if (!hash || hash.length < 2) return;
      var mesmaPagina = a.host === location.host &&
        normalizarCaminho(a.pathname) === normalizarCaminho(location.pathname);
      if (!mesmaPagina) return;
      var alvo = null;
      try { alvo = document.querySelector(hash); } catch (err) { return; }
      if (!alvo || alvo.hidden) return;
      e.preventDefault();
      rolarPara(alvo);
      if (window.history && history.pushState) {
        try { history.pushState(null, '', location.pathname + location.search + hash); } catch (err) {}
      }
    });
  }

  function iniciar(fn) {
    try { fn(); } catch (e) { if (window.console) console.error('[bodyman]', e); }
  }
  iniciar(preencherContato);
  iniciar(ligarMenu);
  iniciar(ligarAncoras);
  iniciar(function () { evento('page_view', { page_title: document.title }, { unico: 'page_view' }); });
})();
