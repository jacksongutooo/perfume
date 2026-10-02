/* =====================================================================
   BODYMAN — DADOS DA LOJA E RECURSOS COMPARTILHADOS

   Carregado em TODAS as páginas (vendas, políticas e rastreio).

   >>> Preencha os campos marcados com PREENCHER. <<<
   Campo vazio = a informação não aparece em lugar nenhum do site.
   Nunca coloque aqui dado que não seja real.

   Preços, fragrâncias e avaliações ficam no script.js.
   ===================================================================== */
(function () {
  'use strict';

  var SITE = {
    BRAND: 'Bodyman',
    STORE_NAME: 'Ideal Store',             // quem vende e entrega
    DOMAIN: 'idealstore.online',

    /* ---- atendimento ---- */
    WHATSAPP_NUMBER: '5516995417328',       // só números, com 55 + DDD
    WHATSAPP_DISPLAY: '(16) 99541-7328',
    WHATSAPP_MESSAGE: 'Olá! Vim pelo site da Bodyman e gostaria de tirar uma dúvida sobre meu pedido/produtos.',
    SUPPORT_HOURS: '',                      // PREENCHER, ex.: 'segunda a sexta, das 9h às 18h'
    EMAIL: '',                              // PREENCHER somente se existir, ex.: 'contato@idealstore.online'

    /* ---- dados da empresa (rodapé e políticas) ---- */
    COMPANY_NAME: '',                       // PREENCHER: razão social
    CNPJ: '',                               // PREENCHER: 00.000.000/0000-00
    ADDRESS: '',                            // PREENCHER: endereço comercial completo
    RETURN_ADDRESS: '',                     // PREENCHER: endereço para devoluções (se diferente)

    /* ---- envio ----
       Postagem no mesmo dia para pagamentos confirmados até o horário de
       corte em dia útil. Sábados, domingos e as datas de HOLIDAYS não são
       dias úteis. Este horário reescreve todos os textos do site. */
    SAME_DAY_SHIPPING_ENABLED: true,
    SAME_DAY_SHIPPING_CUTOFF: '12:00',
    SAME_DAY_SHIPPING_TIMEZONE: 'America/Sao_Paulo',
    SAME_DAY_SHIPPING_HOLIDAYS: [],         // ex.: ['2026-11-02','2026-11-20','2026-12-25']
    SAME_DAY_SHIPPING_COUNTDOWN: true,      // mostra quanto falta para o horário de corte
    DELIVERY_ESTIMATE: '',                  // PREENCHER, ex.: 'de 3 a 12 dias úteis após a postagem, conforme a região'

    /* Link de rastreio da transportadora, com {codigo} no lugar do código.
       Ex. de formato: 'https://site-da-transportadora/rastreio?codigo={codigo}'
       Vazio = a página "Rastrear pedido" orienta pelo WhatsApp. */
    TRACKING_URL: '',

    /* Google Analytics 4 (opcional): 'G-XXXXXXXXXX'. Vazio = desligado.
       Com ele você vê o funil por dispositivo, origem, campanha e UTM. */
    GA4_ID: ''
  };

  /* ================================================================
     utilidades
     ================================================================ */
  function each(lista, fn) { Array.prototype.forEach.call(lista || [], fn); }
  function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }
  function ler(chave, local) {
    try { return JSON.parse((local ? localStorage : sessionStorage).getItem(chave) || 'null'); } catch (e) { return null; }
  }
  function gravar(chave, valor, local) {
    try { (local ? localStorage : sessionStorage).setItem(chave, JSON.stringify(valor)); } catch (e) {}
  }
  function seguro(nome, fn) {
    try { fn(); } catch (e) { if (window.console) console.error('[bodyman] ' + nome, e); }
  }

  function whatsLink(mensagem) {
    return 'https://wa.me/' + SITE.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(mensagem || SITE.WHATSAPP_MESSAGE);
  }

  /* ================================================================
     hora oficial da operação (Brasília) — sem depender de como cada
     navegador escreve a data. Fallback: UTC−3 (sem horário de verão).
     ================================================================ */
  function agora() {
    try {
      var f = new Intl.DateTimeFormat('en-US', {
        timeZone: SITE.SAME_DAY_SHIPPING_TIMEZONE, hour12: false, weekday: 'short',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      var p = {};
      each(f.formatToParts(new Date()), function (x) { p[x.type] = x.value; });
      var r = {
        ano: +p.year, mes: +p.month, dia: +p.day,
        hora: (+p.hour) % 24, minuto: +p.minute,
        semana: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
      };
      if (r.semana >= 0 && !isNaN(r.ano + r.mes + r.dia + r.hora + r.minuto)) return r;
    } catch (e) {}
    var d = new Date(Date.now() - 3 * 3600000);
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(),
             hora: d.getUTCHours(), minuto: d.getUTCMinutes(), semana: d.getUTCDay() };
  }

  function corteMin() {
    var p = String(SITE.SAME_DAY_SHIPPING_CUTOFF || '12:00').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  function rotuloCorte() {
    var t = corteMin(), h = Math.floor(t / 60), m = t % 60;
    return m ? h + 'h' + (m < 10 ? '0' + m : m) : h + 'h';
  }
  function statusEnvio() {
    var a = agora();
    var iso = a.ano + '-' + ('0' + a.mes).slice(-2) + '-' + ('0' + a.dia).slice(-2);
    var util = a.semana !== 0 && a.semana !== 6 && (SITE.SAME_DAY_SHIPPING_HOLIDAYS || []).indexOf(iso) === -1;
    var min = a.hora * 60 + a.minuto;
    var ligado = !!SITE.SAME_DAY_SHIPPING_ENABLED;
    return { ligado: ligado, noPrazo: ligado && util && min < corteMin(), faltam: corteMin() - min };
  }
  function textoFaltam(min) {
    if (!SITE.SAME_DAY_SHIPPING_COUNTDOWN || !(min > 0)) return '';
    var h = Math.floor(min / 60), m = min % 60;
    if (h > 0) return 'faltam ' + h + 'h' + (m ? (m < 10 ? '0' + m : m) : '');
    return (m === 1 ? 'falta ' : 'faltam ') + m + ' min';
  }

  /* ================================================================
     origem do tráfego e dispositivo
     ================================================================ */
  function dispositivo() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'tablet';   // iPadOS
    return 'desktop';
  }
  function navegadorApp() {
    var ua = navigator.userAgent || '';
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|FBMD/i.test(ua)) return 'facebook';
    if (/musical_ly|BytedanceWebview|TikTok|trill/i.test(ua)) return 'tiktok';
    if (/WhatsApp/i.test(ua)) return 'whatsapp';
    return '';
  }

  /* UTMs: mesmo formato que o checkout já usava (sessionStorage bm_utm). */
  function capturarOrigem() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { params = { get: function () { return null; } }; }
    var utm = ler('bm_utm') || {};
    var mudou = false;
    each(['source', 'medium', 'campaign', 'content', 'term'], function (c) {
      var v = params.get('utm_' + c);
      if (v) { utm[c] = String(v).slice(0, 120); mudou = true; }
    });
    if (mudou) gravar('bm_utm', utm);

    var origem = ler('bm_origem');
    if (!origem || mudou) {
      var ref = '';
      try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
      if (ref === location.hostname) ref = '';
      var app = navegadorApp();
      var fonte = utm.source ||
        (params.get('gclid') ? 'google' : '') ||
        (params.get('ttclid') ? 'tiktok' : '') ||
        (params.get('fbclid') ? (app === 'instagram' ? 'instagram' : 'facebook') : '') ||
        (/instagram/i.test(ref) ? 'instagram' : '') ||
        (/facebook|fb\.com|fb\.me/i.test(ref) ? 'facebook' : '') ||
        (/google\./i.test(ref) ? 'google' : '') ||
        (/tiktok/i.test(ref) ? 'tiktok' : '') ||
        (/whatsapp|wa\.me/i.test(ref) ? 'whatsapp' : '') ||
        app || (ref ? ref : 'direto');
      var meio = utm.medium ||
        (params.get('gclid') || params.get('ttclid') || params.get('fbclid') ? 'pago' : '') ||
        (ref || app ? 'referencia' : 'direto');
      origem = {
        source: String(fonte).slice(0, 60),
        medium: String(meio).slice(0, 60),
        campaign: utm.campaign || '',
        content: utm.content || '',
        term: utm.term || '',
        referrer: ref.slice(0, 80),
        app: app,
        landing: (location.pathname || '/').slice(0, 80)
      };
      gravar('bm_origem', origem);
    }
    return origem;
  }

  var ORIGEM = { source: 'direto', medium: 'direto', campaign: '', content: '', term: '', referrer: '', app: '', landing: '/' };
  var DISPOSITIVO = 'desktop';
  seguro('origem', function () { ORIGEM = capturarOrigem(); DISPOSITIVO = dispositivo(); });

  /* contexto enviado junto com o pedido (gravado no servidor para análise) */
  function contexto(extra) {
    var c = {
      device: DISPOSITIVO, app: ORIGEM.app, source: ORIGEM.source, medium: ORIGEM.medium,
      campaign: ORIGEM.campaign, referrer: ORIGEM.referrer, landing: ORIGEM.landing
    };
    for (var k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) c[k] = extra[k];
    return c;
  }

  /* ================================================================
     FUNIL DE EVENTOS

     page_view → view_product → click_buy → select_offer →
     begin_checkout → add_customer_info → add_shipping_info →
     pix_generated → purchase   (+ pix_copied, whatsapp_click, pix_error)

     Cada evento vai para:
       - window.dataLayer (pronto para Google Tag Manager)
       - Meta Pixel (padrão do Meta quando existe equivalente)
       - Google Analytics 4, se GA4_ID estiver preenchido
     Todos levam dispositivo, origem, campanha e UTM.
     Use ?debug_funil=1 na URL para ver os eventos no console.
     ================================================================ */
  var META = {
    view_product:      { std: 'ViewContent' },
    select_offer:      { std: 'AddToCart' },
    begin_checkout:    { std: 'InitiateCheckout' },
    pix_generated:     { std: 'AddPaymentInfo' },
    purchase:          { std: 'Purchase' },
    whatsapp_click:    { std: 'Contact' },
    click_buy:         { custom: 'ClickBuy' },
    add_shipping_info: { custom: 'AddShippingInfo' },
    pix_copied:        { custom: 'PixCopied' }
  };
  var GA4 = {
    view_product: 'view_item', select_offer: 'add_to_cart', begin_checkout: 'begin_checkout',
    add_shipping_info: 'add_shipping_info', pix_generated: 'add_payment_info', purchase: 'purchase',
    click_buy: 'click_buy', add_customer_info: 'add_customer_info', pix_copied: 'pix_copied',
    whatsapp_click: 'whatsapp_click', pix_error: 'pix_error'
  };

  /* Uma vez por carregamento de página (por chave) ... */
  var unicosPagina = {};
  /* ... e uma vez para sempre (por pedido), sobrevivendo a recarregamentos. */
  function jaEnviadoPedido(nome, ref) {
    var lista = ler('bm_eventos_pedido', true) || [];
    var chave = nome + ':' + ref;
    if (lista.indexOf(chave) !== -1) return true;
    lista.push(chave);
    gravar('bm_eventos_pedido', lista.slice(-60), true);
    return false;
  }

  var debug = /[?&]debug_funil=1/.test(location.search);

  function track(nome, dados) {
    dados = dados || {};

    if (nome === 'page_view' || nome === 'view_product') {
      if (unicosPagina[nome]) return; unicosPagina[nome] = 1;
    }
    if (nome === 'select_offer' || nome === 'begin_checkout') {
      var k = nome + ':' + (dados.offer || '');
      if (unicosPagina[k]) return; unicosPagina[k] = 1;
    }
    if ((nome === 'pix_generated' || nome === 'purchase') && dados.order_id) {
      if (jaEnviadoPedido(nome, dados.order_id)) return;
    }

    var payload = {
      event: nome,
      device: DISPOSITIVO,
      in_app: ORIGEM.app || 'nao',
      traffic_source: ORIGEM.source,
      traffic_medium: ORIGEM.medium,
      utm_campaign: ORIGEM.campaign,
      utm_content: ORIGEM.content,
      utm_term: ORIGEM.term,
      page: location.pathname
    };
    for (var c in dados) if (Object.prototype.hasOwnProperty.call(dados, c)) payload[c] = dados[c];

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    try { window.dispatchEvent(new CustomEvent('bodyman:' + nome, { detail: payload })); } catch (e) {}
    if (debug && window.console) console.info('[funil]', nome, payload);

    seguro('meta', function () { enviarMeta(nome, payload); });
    seguro('ga4', function () { enviarGA4(nome, payload); });
  }

  function enviarMeta(nome, d) {
    var m = META[nome];
    if (!m || typeof window.fbq !== 'function') return;
    var props = { currency: 'BRL', content_type: 'product', device: d.device, traffic_source: d.traffic_source };
    if (d.value != null) props.value = d.value;
    if (d.products) props.content_ids = d.products;
    else if (d.offer) props.content_ids = [d.offer];
    if (d.offer) props.content_name = d.offer;
    if (d.num_items) props.num_items = d.num_items;
    if (d.cta) props.cta = d.cta;
    if (m.std) {
      var id = d.order_id ? (nome === 'purchase' ? d.order_id : nome + '-' + d.order_id) : null;
      if (id) window.fbq('track', m.std, props, { eventID: id });
      else window.fbq('track', m.std, props);
    } else {
      window.fbq('trackCustom', m.custom, props);
    }
  }

  function iniciarGA4() {
    if (!SITE.GA4_ID || !/^G-[A-Z0-9]+$/i.test(SITE.GA4_ID)) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(SITE.GA4_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', SITE.GA4_ID, { device_type: DISPOSITIVO, in_app: ORIGEM.app || 'nao' });
  }

  function enviarGA4(nome, d) {
    if (!SITE.GA4_ID || typeof window.gtag !== 'function') return;
    var ev = GA4[nome];
    if (!ev) return;
    var p = { currency: 'BRL', device_type: d.device, in_app: d.in_app, offer: d.offer || '' };
    if (d.value != null) p.value = d.value;
    if (d.cta) p.cta = d.cta;
    if (d.order_id) p.transaction_id = d.order_id;
    if (d.offer) p.items = [{ item_id: d.offer, item_name: 'Bodyman ' + d.offer, price: d.value || 0, quantity: 1 }];
    window.gtag('event', ev, p);
  }

  /* ================================================================
     interface comum: dados da loja nos textos, menu, WhatsApp
     ================================================================ */
  function preencherDados() {
    /* <span data-site-text="EMAIL"></span> recebe o valor */
    each($$('[data-site-text]'), function (el) {
      var v = SITE[el.getAttribute('data-site-text')];
      if (v) el.textContent = v;
    });
    /* blocos que só aparecem quando o dado existe (ficam hidden no HTML) */
    each($$('[data-site-if]'), function (el) {
      var campos = el.getAttribute('data-site-if').split(/\s+/);
      var tem = true;
      each(campos, function (c) { if (!SITE[c] || (SITE[c].length === 0)) tem = false; });
      el.hidden = !tem;
    });
    /* alternativa para quando o dado NÃO existe */
    each($$('[data-site-unless]'), function (el) {
      el.hidden = !!SITE[el.getAttribute('data-site-unless')];
    });
    each($$('a[data-site-href="email"]'), function (a) { if (SITE.EMAIL) a.href = 'mailto:' + SITE.EMAIL; });
    each($$('[data-ano]'), function (el) { el.textContent = String(agora().ano); });
    each($$('[data-corte]'), function (el) { el.textContent = rotuloCorte(); });
  }

  /* todos os links de WhatsApp: número e mensagem vêm do SITE */
  function ligarWhatsApp() {
    each($$('a[data-wa]'), function (a) {
      var msg = a.getAttribute('data-wa-msg');
      a.href = whatsLink(msg || '');
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href*="wa.me/"]') : null;
      if (a) track('whatsapp_click', { cta: a.getAttribute('data-wa') || 'link' });
    });
  }

  function ligarMenu() {
    var botao = document.querySelector('.bm-menu-btn');
    var menu = document.getElementById('bm-menu');
    if (!botao || !menu) return;
    function abrir(sim) {
      botao.setAttribute('aria-expanded', sim ? 'true' : 'false');
      menu.setAttribute('data-aberto', sim ? 'true' : 'false');
      document.documentElement.classList.toggle('bm-menu-aberto', sim);
    }
    botao.addEventListener('click', function () { abrir(botao.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) abrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') abrir(false); });
    document.addEventListener('click', function (e) {
      if (botao.getAttribute('aria-expanded') === 'true' && !menu.contains(e.target) && !botao.contains(e.target)) abrir(false);
    });
  }

  /* ?preview=1 mostra os espaços reservados para fotos e textos pendentes */
  function modoPreview() {
    if (/[?&]preview=1/.test(location.search)) document.documentElement.classList.add('bm-preview');
  }

  /* ================================================================
     superfície pública
     ================================================================ */
  window.BM = {
    site: SITE,
    each: each,
    seguro: seguro,
    whatsLink: whatsLink,
    track: track,
    contexto: contexto,
    dispositivo: function () { return DISPOSITIVO; },
    origem: function () { return ORIGEM; },
    envio: { agora: agora, status: statusEnvio, rotuloCorte: rotuloCorte, textoFaltam: textoFaltam }
  };

  seguro('preview', modoPreview);
  seguro('ga4', iniciarGA4);

  function iniciar() {
    seguro('dados', preencherDados);
    seguro('whatsapp', ligarWhatsApp);
    seguro('menu', ligarMenu);
    track('page_view', {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
