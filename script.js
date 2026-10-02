/* =====================================================================
   BODYMAN — PÁGINA DE VENDAS

   Preços, avaliações e regras da oferta. Dados da loja (WhatsApp,
   empresa, horário de postagem) ficam no site.js.

   Os valores abaixo também estão escritos no index.html, para a página
   nunca aparecer com campos vazios enquanto este arquivo carrega.
   Ao mudar um preço: altere aqui, no index.html (busque o valor antigo)
   e em api/_config.js (o que é cobrado de verdade).
   ===================================================================== */
(function () {
  'use strict';

  var BM = window.BM || { each: function (l, f) { Array.prototype.forEach.call(l || [], f); },
                          seguro: function (n, f) { try { f(); } catch (e) {} },
                          track: function () {}, site: {}, envio: null };
  var each = BM.each;

  var CONFIG = {
    SINGLE_PRICE: 49.90,   // 1 frasco
    DOUBLE_PRICE: 79.90,   // 2 frascos
    TRIPLE_PRICE: 97.00,   // kit com 3

    /* Frete grátis a partir de quantos frascos. O servidor (api/_config.js,
       SHIPPING_AMOUNT = 0) não cobra frete em nenhuma opção e o checkout
       mostra "Grátis" para todas, então a página mostra o mesmo. */
    FREE_SHIPPING_MIN_ITEMS: 1,

    /* Média de avaliação. null = calculada a partir das avaliações com nota
       (recomendado: o número mostrado é sempre o que está na página). */
    AVERAGE_RATING_OVERRIDE: null,

    /* Vendas acumuladas em outro canal. Só exiba se o número for real e
       comprovável. false = não aparece. */
    SHOW_PREVIOUS_SALES: false,
    PREVIOUS_SALES: 4000,

    /* URL de checkout externo. Vazio = usa o checkout PIX deste site. */
    CHECKOUT_URL: ''
  };

  /* ================================================================
     AVALIAÇÕES DOS CLIENTES — somente avaliações reais.

     Campos:
       name      nome do cliente (ex.: 'Lucas A.'). Vazio = "Cliente Bodyman"
       rating    nota de 1 a 5. null = sem nota (não mostra estrelas)
       text      comentário do cliente, com as palavras dele
       date      'AAAA-MM-DD' da avaliação
       product   o que a pessoa comprou (ex.: 'Kit completo', 'Midtown')
       photos    fotos do produto enviadas pelo cliente:
                 [{ src:'img/clientes/x.webp', thumb:'img/clientes/x-p.webp' }]
                 (thumb é opcional; sem ele a foto grande é usada)
       avatar    foto do cliente (opcional)
       verified  true só quando a avaliação foi conferida com um pedido real.
                 O selo "Compra verificada" exige também orderRef.
       orderRef  número do pedido (ex.: 'IDEAL-20260920-AB12CD34'). Não aparece
                 na página; serve para você saber de qual pedido é.
       featured  true = aparece nos destaques perto do botão de compra (até 3)
       age       idade (opcional)
     ================================================================ */
  var REVIEWS = [
    /* ---- Fotos reais enviadas por clientes ----
       Nome, nota, comentário e data ficaram em branco porque não temos esses
       dados. PREENCHER com as informações reais de cada cliente quando tiver. */
    { name:'', rating:null, text:'', date:'', product:'Kit completo',
      photos:[{ src:'img/clientes/cliente-2.webp', thumb:'img/clientes/cliente-2-p.webp' }],
      verified:false, orderRef:'', featured:true },
    { name:'', rating:null, text:'', date:'', product:'Kit completo',
      photos:[{ src:'img/clientes/cliente-5.webp', thumb:'img/clientes/cliente-5-p.webp' }],
      verified:false, orderRef:'', featured:true },
    { name:'', rating:null, text:'', date:'', product:'Kit completo',
      photos:[{ src:'img/clientes/cliente-3.webp', thumb:'img/clientes/cliente-3-p.webp' }],
      verified:false, orderRef:'', featured:true },
    { name:'', rating:null, text:'', date:'', product:'Kit completo',
      photos:[{ src:'img/clientes/cliente-1.webp', thumb:'img/clientes/cliente-1-p.webp' }],
      verified:false, orderRef:'' },
    { name:'', rating:null, text:'', date:'', product:'Kit completo',
      photos:[{ src:'img/clientes/cliente-4.webp', thumb:'img/clientes/cliente-4-p.webp' }],
      verified:false, orderRef:'' },

    /* ---- Avaliações em texto que já estavam no site (mantidas como estavam) ----
       Não têm data, foto nem número de pedido. Mantenha só as que forem reais. */
    { name:'Lucas Andrade', initials:'LA', age:23, rating:5, product:'Kit completo',
      text:'Peguei o kit com os três e valeu demais. O Enigma virou meu favorito, mas os três são bem diferentes entre si. Na minha pele senti o cheiro por umas 5 horas tranquilo. Pelo preço do trio, achei muito bom.' },
    { name:'Rafael Mendes', initials:'RM', age:31, rating:5, product:'Kit completo',
      text:'Chegou rápido e muito bem embalado. Gostei bastante da proposta de ter três fragrâncias pra momentos diferentes. Barbarius é mais forte, Midtown é mais suave e Enigma fica no meio. Kit completo vale muito mais a pena.' },
    { name:'Bruno Carvalho', initials:'BC', age:27, rating:5, product:'Kit completo',
      text:'Pelo preço eu tava esperando algo mais simples, mas me surpreendeu. Frasco grande de 200 ml e cheiro bem agradável. Em mim a fixação ficou perto de 4 a 5 horas. Compraria novamente.' },
    { name:'Gustavo Lima', initials:'GL', age:38, rating:5, product:'Kit completo',
      text:'Comprei o trio e não me arrependo. Uso um no trabalho, outro pra sair e outro no dia a dia. A variedade é o melhor do kit. Veio tudo certinho e bem protegido.' },
    { name:'Mateus Rocha', initials:'MR', age:21, rating:4, product:'Midtown',
      text:'Curti bastante. Meu favorito foi o Midtown porque é mais limpo e fácil de usar todo dia. A duração na minha pele ficou em torno de 4 horas. Pelo valor, achei justo demais.' },
    { name:'Diego Martins', initials:'DM', age:34, rating:5, product:'Kit completo',
      text:'Barbarius é absurdo de bom pra noite. Tem uma pegada mais marcante e diferente. O kit com três compensa porque você não fica preso em uma fragrância só. Chegou bem rápido aqui.' },
    { name:'Felipe Souza', initials:'FS', age:29, rating:5, product:'Enigma',
      text:'Já tinha usado body splash antes, mas esses me surpreenderam. O Enigma ficou umas 5 horas na minha pele e ainda dava pra sentir de perto depois. Gostei bastante da embalagem também.' },
    { name:'André Ribeiro', initials:'AR', age:42, rating:5, product:'Kit completo',
      text:'Gostei da apresentação e principalmente do custo-benefício. São três frascos grandes e cada um tem uma proposta diferente. Pra quem gosta de variar perfume, faz bastante sentido.' },
    { name:'Caio Fernandes', initials:'CF', age:19, rating:5, product:'Kit completo',
      text:'Kit muito bom pelo preço. Eu e meu irmão já estamos disputando o Barbarius kkk. Cheiro forte na medida e na minha pele durou perto de 6 horas.' },
    { name:'Eduardo Nunes', initials:'EN', age:45, rating:5, product:'Kit completo',
      text:'Produto chegou bem embalado, sem vazamento e dentro do esperado. Gostei mais do Enigma, tem um cheiro elegante e fácil de usar. O trio foi uma boa compra.' },
    { name:'Henrique Alves', initials:'HA', age:26, rating:5, product:'Kit completo',
      text:'Eu ia pegar só dois, mas pela diferença de preço preferi levar os três. Ainda bem que fiz isso, porque o Midtown que eu achava que seria o que menos usaria acabou sendo um dos melhores.' },
    { name:'Marcelo Costa', initials:'MC', age:52, rating:4, product:'Kit completo',
      text:'Boa variedade de fragrâncias e frascos com ótimo tamanho. Não são todos iguais, cada um tem um estilo bem próprio. Em mim a duração ficou em torno de 4 horas, o que achei bom para body splash.' },
    { name:'João Pedro Santos', initials:'JS', age:24, rating:5, product:'Kit completo',
      text:'O kit completo é disparado a melhor opção. Três body splash de 200 ml por esse valor compensa demais. Chegou rápido e tudo bem protegido.' },
    { name:'Thiago Moreira', initials:'TM', age:36, rating:5, product:'Kit completo',
      text:'O Barbarius foi o que mais gostei. Mais intenso e com presença. O Enigma também é muito bom pra usar à noite. No meu caso ficaram umas 5 horas perceptíveis.' },
    { name:'Leonardo Freitas', initials:'LF', age:28, rating:5, product:'Kit completo',
      text:'Gostei porque não parece que você comprou três cheiros iguais com rótulos diferentes. Cada um tem uma identidade. Pelo preço do combo, achei excelente.' },
    { name:'Rodrigo Teixeira', initials:'RT', age:41, rating:5, product:'Midtown',
      text:'Recebi antes do que esperava e veio tudo muito bem embalado. O Midtown é ótimo pra usar no trabalho porque é mais discreto e sofisticado. Vou comprar o kit novamente quando acabar.' },
    { name:'Vinícius Barros', initials:'VB', age:22, rating:5, product:'Enigma',
      text:'Pra mim o Enigma ganhou fácil. Cheiro muito bom e fixa legal. Passei de manhã e umas 4 a 5 horas depois ainda sentia na pele. O trio compensa demais.' },
    { name:'Alexandre Moraes', initials:'AM', age:48, rating:4, product:'Kit completo',
      text:'Bom custo-benefício. Os frascos são grandes e o kit permite variar bastante. Gostei especialmente do Midtown. Entrega rápida e embalagem bem feita.' },
    { name:'Murilo Cardoso', initials:'MC', age:33, rating:5, product:'Kit completo',
      text:'Comprei pela promoção do trio e achei que valeu cada real. O Barbarius é mais intenso, Enigma mais elegante e Midtown mais versátil. Uso os três dependendo da ocasião.' },
    { name:'Daniel Pires', initials:'DP', age:57, rating:5, product:'Kit completo',
      text:'Gostei bastante da qualidade geral. Boa apresentação, fragrâncias agradáveis e quantidade excelente. Na minha pele a duração ficou perto de 5 horas. Pelo valor do kit completo, achei uma ótima compra.' }
  ];

  /* ---------------- fragrâncias ---------------- */
  var FRAGRANCIAS = {
    enigma:    { nome: 'Enigma',    img: 'enigma.webp',    perfil: 'Elegante' },
    midtown:   { nome: 'Midtown',   img: 'midtown.webp',   perfil: 'Versátil' },
    barbarius: { nome: 'Barbarius', img: 'barbarius.webp', perfil: 'Intenso' }
  };
  var ORDEM = ['enigma', 'midtown', 'barbarius'];

  /* ================================================================
     preços
     ================================================================ */
  var PRECO = { '1': CONFIG.SINGLE_PRICE, '2': CONFIG.DOUBLE_PRICE, 'kit': CONFIG.TRIPLE_PRICE };
  var MAPA = { single: '1', double: '2', triple: 'kit' };
  var PLANO_POR_OPCAO = { '1': 'single', '2': 'double', 'kit': 'triple' };
  var NOME_OPCAO = { 'kit': 'Kit completo', '2': '2 frascos', '1': '1 frasco' };

  function brl(v) {
    var s = (Math.round(v * 100) / 100).toFixed(2).split('.');
    return 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function qtdDe(op) { return op === 'kit' ? 3 : parseInt(op, 10); }
  function precoDe(op) { return PRECO[op]; }
  function precoAvulso(op) { return CONFIG.SINGLE_PRICE * qtdDe(op); }
  function precoUnitario(op) { return PRECO[op] / qtdDe(op); }
  function economia(op) { return precoAvulso(op) - PRECO[op]; }
  var DIFERENCA_2_PARA_3 = CONFIG.TRIPLE_PRICE - CONFIG.DOUBLE_PRICE;

  function preencherValores() {
    function aplicar(attr, fn) {
      each(document.querySelectorAll('[' + attr + ']'), function (el) {
        var op = MAPA[el.getAttribute(attr)];
        if (op) el.textContent = brl(fn(op));
      });
    }
    aplicar('data-preco', precoDe);
    aplicar('data-unit', precoUnitario);
    aplicar('data-econ', economia);
    aplicar('data-de', precoAvulso);
    each(document.querySelectorAll('[data-diff]'), function (el) { el.textContent = brl(DIFERENCA_2_PARA_3); });
  }

  /* ================================================================
     envio no mesmo dia (regra no site.js)
     ================================================================ */
  function aplicarEnvio() {
    if (!BM.envio) return;
    var st = BM.envio.status();
    var corte = BM.envio.rotuloCorte();
    var falta = st.noPrazo ? BM.envio.textoFaltam(st.faltam) : '';

    var hero = document.querySelector('[data-envio-hero] span');
    if (hero) {
      hero.textContent = st.noPrazo
        ? 'Pague até as ' + corte + ' e seu pedido é postado hoje' + (falta ? ' (' + falta + ')' : '')
        : 'Postagem em até 1 dia útil após a confirmação do pagamento';
    }
    each(document.querySelectorAll('[data-envio-detalhe]'), function (el) { el.hidden = !st.ligado; });
    each(document.querySelectorAll('[data-envio-etapa]'), function (el) {
      if (!st.ligado) el.textContent = 'Postagem em até 1 dia útil após a confirmação do pagamento.';
    });
  }

  /* ================================================================
     avaliações
     ================================================================ */
  var CORES_AVATAR = ['#3E5C8A', '#5B6B4E', '#7A5C46', '#4F4A6E', '#2F6670', '#6B4E5E'];

  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fotosDe(r) {
    var lista = r.photos || (r.photo ? [r.photo] : []);
    var saida = [];
    each(lista, function (f) {
      if (!f) return;
      var o = typeof f === 'string' ? { src: f } : f;
      if (o.src) saida.push({ src: o.src, thumb: o.thumb || o.src });
    });
    return saida;
  }
  function temNota(r) { return typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5; }
  function verificada(r) { return r.verified === true && !!r.orderRef && !r.demo; }
  function nomeDe(r) { return r.name && String(r.name).trim() ? r.name : 'Cliente Bodyman'; }
  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  function iniciais(r) {
    if (r.initials) return r.initials;
    var p = String(r.name || '').split(' ').filter(Boolean);
    return p.length ? (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() : 'C';
  }
  function estrelas(nota) {
    var n = Math.max(0, Math.min(5, nota));
    return '<span class="bm-stars" role="img" aria-label="Nota ' + String(n).replace('.', ',') + ' de 5">★★★★★' +
           '<i style="width:' + (n / 5 * 100) + '%">★★★★★</i></span>';
  }

  var COM_NOTA = REVIEWS.filter(temNota);
  function mediaNotas() {
    if (typeof CONFIG.AVERAGE_RATING_OVERRIDE === 'number') return CONFIG.AVERAGE_RATING_OVERRIDE;
    if (!COM_NOTA.length) return null;
    var soma = 0;
    each(COM_NOTA, function (r) { soma += r.rating; });
    return Math.floor((soma / COM_NOTA.length) * 10) / 10;    // nunca arredonda para cima
  }

  function aplicarNota() {
    var media = mediaNotas();
    if (media === null) {
      /* sem nenhuma nota real: não mostra estrelas nem média */
      var linha = document.getElementById('bm-nota-hero');
      if (linha) linha.hidden = true;
      each(document.querySelectorAll('.bm-prova-cab .bm-stars, .bm-prova-cab [data-nota-media]'), function (el) { el.hidden = true; });
      var topo = document.getElementById('bm-av-topo');
      if (topo) topo.hidden = true;
      return;
    }
    var txt = media.toFixed(1).replace('.', ',');
    each(document.querySelectorAll('[data-nota-media]'), function (el) { el.textContent = txt; });
    each(document.querySelectorAll('.bm-nota-linha .bm-stars i, .bm-prova-cab .bm-stars i, .bm-av-nota .bm-stars i'), function (el) {
      el.style.width = (media / 5 * 100) + '%';
    });
    if (CONFIG.SHOW_PREVIOUS_SALES && CONFIG.PREVIOUS_SALES) {
      var hero = document.getElementById('bm-nota-hero');
      if (hero) {
        var s = document.createElement('span');
        s.textContent = '· +' + Number(CONFIG.PREVIOUS_SALES).toLocaleString('pt-BR') + ' vendas';
        hero.appendChild(s);
      }
    }
  }

  /* lista de fotos usada pelo visualizador */
  function itensFotos(lista) {
    var itens = [];
    each(lista, function (r) {
      each(fotosDe(r), function (f) {
        itens.push({ src: f.src, alt: 'Foto enviada por cliente — ' + (r.product || 'Bodyman'), legenda: nomeDe(r) + (r.product ? ' · ' + r.product : '') });
      });
    });
    return itens;
  }

  function cardMini(r, i) {
    var f = fotosDe(r)[0];
    var meta = [r.product || '', dataBR(r.date)].filter(Boolean).join(' · ');
    return '<article class="bm-mini-av">' +
      (f ? '<button type="button" class="bm-mini-av-foto" data-lb-grupo="destaques" data-lb-i="' + i + '" aria-label="Ampliar foto enviada por ' + escapar(nomeDe(r)) + '">' +
             '<img src="' + escapar(f.thumb) + '" alt="Foto do kit Bodyman enviada por cliente" loading="lazy" decoding="async"></button>' : '') +
      '<div class="bm-mini-av-corpo">' +
        (temNota(r) ? estrelas(r.rating) : '') +
        (r.text ? '<p class="bm-mini-av-texto">' + escapar(r.text) + '</p>' : '') +
        '<p class="bm-mini-av-nome">' + escapar(nomeDe(r)) + '</p>' +
        (meta ? '<p class="bm-mini-av-meta">' + escapar(meta) + '</p>' : '') +
        (verificada(r) ? '<span class="bm-verificada">✓ Compra verificada</span>' : '') +
      '</div>' +
    '</article>';
  }

  function cardFoto(r, i) {
    var f = fotosDe(r)[0];
    return '<article class="bm-av-card bm-av-card--foto">' +
      '<button type="button" class="bm-thumb" data-lb-review="' + i + '" data-lb-j="0" aria-label="Ampliar foto enviada por ' + escapar(nomeDe(r)) + '">' +
        '<img src="' + escapar(f.thumb) + '" alt="Foto do kit Bodyman enviada por cliente" loading="lazy" decoding="async"></button>' +
      '<div class="bm-av-tile-txt"><p class="bm-av-nome">' + escapar(nomeDe(r)) + '</p>' +
        '<p class="bm-av-meta">' + escapar([r.product, dataBR(r.date)].filter(Boolean).join(' · ')) + '</p>' +
        (verificada(r) ? '<span class="bm-verificada">✓ Compra verificada</span>' : '') +
      '</div>' +
    '</article>';
  }

  function cardCompleto(r, i) {
    var fotos = fotosDe(r);
    if (!r.text && !temNota(r) && fotos.length) return cardFoto(r, i);
    var meta = [dataBR(r.date), r.age ? r.age + ' anos' : ''].filter(Boolean).join(' · ');
    var avatar = r.avatar
      ? '<span class="bm-avatar"><img src="' + escapar(r.avatar) + '" alt="" loading="lazy"></span>'
      : '<span class="bm-avatar" style="background:' + CORES_AVATAR[i % CORES_AVATAR.length] + '" aria-hidden="true">' + escapar(iniciais(r)) + '</span>';
    var thumbs = '';
    each(fotos, function (f, j) {
      thumbs += '<button type="button" class="bm-thumb" data-lb-review="' + i + '" data-lb-j="' + j + '" aria-label="Ampliar foto ' + (j + 1) + ' de ' + escapar(nomeDe(r)) + '">' +
                '<img src="' + escapar(f.thumb) + '" alt="Foto enviada por cliente" loading="lazy" decoding="async"></button>';
    });
    return '<article class="bm-av-card">' +
      '<div class="bm-av-cab">' + avatar +
        '<div class="bm-av-quem"><p class="bm-av-nome">' + escapar(nomeDe(r)) + '</p>' +
          (meta ? '<p class="bm-av-meta">' + escapar(meta) + '</p>' : '') + '</div>' +
        (verificada(r) ? '<span class="bm-verificada">✓ Compra verificada</span>' : '') +
      '</div>' +
      (temNota(r) ? estrelas(r.rating) : '') +
      (r.text ? '<p class="bm-av-texto">' + escapar(r.text) + '</p>' : '') +
      (thumbs ? '<div class="bm-av-fotos-card">' + thumbs + '</div>' : '') +
      (r.product ? '<p class="bm-av-produto">Produto: ' + escapar(r.product) + '</p>' : '') +
    '</article>';
  }

  var DESTAQUES = [];
  function montarDestaques() {
    var bloco = document.getElementById('bm-prova');
    var lista = document.getElementById('bm-destaques');
    if (!bloco || !lista) return;
    DESTAQUES = REVIEWS.filter(function (r) { return r.featured; }).slice(0, 3);
    /* completa até 3 com avaliações que têm foto, depois com as de nota mais alta */
    var extras = REVIEWS.filter(function (r) { return !r.featured && fotosDe(r).length; })
      .concat(REVIEWS.filter(function (r) { return !r.featured && !fotosDe(r).length && r.text && r.rating === 5; }));
    while (DESTAQUES.length < 3 && extras.length) DESTAQUES.push(extras.shift());
    if (!DESTAQUES.length) return;
    lista.innerHTML = DESTAQUES.map(cardMini).join('');
    bloco.hidden = false;
  }

  /* lista completa com filtros */
  var ORDENADAS = REVIEWS.map(function (r, i) { return { r: r, i: i }; })
    .sort(function (a, b) {
      var ta = a.r.text ? 1 : 0, tb = b.r.text ? 1 : 0;
      if (ta !== tb) return tb - ta;
      var fa = fotosDe(a.r).length ? 1 : 0, fb = fotosDe(b.r).length ? 1 : 0;
      if (fa !== fb) return fb - fa;
      var da = a.r.date || '', db = b.r.date || '';
      if (da !== db) return da < db ? 1 : -1;
      return a.i - b.i;
    });
  var filtro = 'todas', mostrando = 6, POR_PAGINA = 6;

  function filtrar(nome) {
    return ORDENADAS.filter(function (o) {
      if (nome === '5') return o.r.rating === 5;
      if (nome === '4') return o.r.rating === 4;
      if (nome === 'fotos') return fotosDe(o.r).length > 0;
      return true;
    });
  }

  function montarResumoAvaliacoes() {
    var nota = document.getElementById('bm-av-nota');
    var barras = document.getElementById('bm-av-barras');
    var total = document.getElementById('bm-av-total');
    if (!COM_NOTA.length && typeof CONFIG.AVERAGE_RATING_OVERRIDE !== 'number') return;
    if (nota) nota.hidden = false;
    var topo = document.getElementById('bm-av-topo');
    if (topo) topo.hidden = false;
    if (total) total.textContent = COM_NOTA.length + (COM_NOTA.length === 1 ? ' avaliação com nota' : ' avaliações com nota');
    if (barras && COM_NOTA.length) {
      var html = '';
      for (var n = 5; n >= 1; n--) {
        var qtd = COM_NOTA.filter(function (r) { return r.rating === n; }).length;
        html += '<div class="bm-av-barra"><span>' + n + ' ★</span><i><b style="width:' + (qtd / COM_NOTA.length * 100) + '%"></b></i><span>' + qtd + '</span></div>';
      }
      barras.innerHTML = html;
    }
  }

  function montarFotosClientes() {
    var bloco = document.getElementById('bm-av-fotos-bloco');
    var lista = document.getElementById('bm-av-fotos');
    var itens = [];
    each(ORDENADAS, function (o) { each(fotosDe(o.r), function (f) { itens.push(f); }); });
    if (!bloco || !lista || !itens.length) return;
    lista.innerHTML = itens.map(function (f, i) {
      return '<button type="button" class="bm-thumb" data-lb-grupo="clientes" data-lb-i="' + i + '" aria-label="Ampliar foto de cliente ' + (i + 1) + '">' +
             '<img src="' + escapar(f.thumb) + '" alt="Foto do kit Bodyman enviada por cliente" loading="lazy" decoding="async"></button>';
    }).join('');
    bloco.hidden = false;
  }

  function montarFiltros() {
    each(document.querySelectorAll('#bm-av-filtros [data-filtro]'), function (b) {
      var nome = b.getAttribute('data-filtro');
      var qtd = filtrar(nome).length;
      if (!qtd && nome !== 'todas') { b.hidden = true; return; }
      b.innerHTML = escapar(b.textContent.replace(/\s*\(\d+\)$/, '')) + ' <small>(' + qtd + ')</small>';
      b.addEventListener('click', function () {
        filtro = nome; mostrando = POR_PAGINA;
        each(document.querySelectorAll('#bm-av-filtros [data-filtro]'), function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        montarLista();
      });
    });
  }

  function montarLista() {
    var lista = document.getElementById('bm-av-lista');
    var mais = document.getElementById('bm-av-mais');
    var vazio = document.getElementById('bm-av-vazio');
    if (!lista) return;
    var todas = filtrar(filtro);
    lista.innerHTML = todas.slice(0, mostrando).map(function (o) { return cardCompleto(o.r, o.i); }).join('');
    if (vazio) vazio.hidden = todas.length > 0;
    if (mais) mais.hidden = todas.length <= mostrando;
  }

  function renderAvaliacoes() {
    if (!REVIEWS.length) {
      var secao = document.getElementById('bm-av');
      if (secao) secao.hidden = true;
      return;
    }
    montarResumoAvaliacoes();
    montarFotosClientes();
    montarFiltros();
    montarLista();
    var mais = document.getElementById('bm-av-mais');
    if (mais) mais.addEventListener('click', function () { mostrando += POR_PAGINA; montarLista(); });
  }

  /* ================================================================
     visualizador de fotos (avaliações e galeria)
     ================================================================ */
  var lb = null, lbItens = [], lbIndice = 0, lbHistorico = false;

  function criarLb() {
    lb = document.createElement('div');
    lb.className = 'bm-lb';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Foto ampliada');
    lb.innerHTML =
      '<button type="button" class="bm-lb-x" aria-label="Fechar">&times;</button>' +
      '<button type="button" class="bm-lb-nav bm-lb-nav--ant" aria-label="Foto anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      '<img alt="">' +
      '<p class="bm-lb-legenda"></p>' +
      '<button type="button" class="bm-lb-nav bm-lb-nav--prox" aria-label="Próxima foto"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>';
    document.body.appendChild(lb);
    lb.addEventListener('click', function (e) {
      if (e.target === lb || (e.target.closest && e.target.closest('.bm-lb-x'))) fecharLb();
      else if (e.target.closest && e.target.closest('.bm-lb-nav--ant')) moverLb(-1);
      else if (e.target.closest && e.target.closest('.bm-lb-nav--prox')) moverLb(1);
    });
    document.addEventListener('keydown', function (e) {
      if (!lb || lb.hidden) return;
      if (e.key === 'Escape') fecharLb();
      if (e.key === 'ArrowLeft') moverLb(-1);
      if (e.key === 'ArrowRight') moverLb(1);
    });
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 45) moverLb(dx < 0 ? 1 : -1);
    });
    window.addEventListener('popstate', function () { if (lb && !lb.hidden) { lbHistorico = false; fecharLb(); } });
  }

  function mostrarLb() {
    var it = lbItens[lbIndice];
    var img = lb.querySelector('img');
    img.src = it.src; img.alt = it.alt || '';
    lb.querySelector('.bm-lb-legenda').textContent = it.legenda || '';
    var multi = lbItens.length > 1;
    each(lb.querySelectorAll('.bm-lb-nav'), function (b) { b.hidden = !multi; });
  }
  function abrirLb(itens, i) {
    if (!itens.length) return;
    if (!lb) criarLb();
    lbItens = itens; lbIndice = Math.max(0, Math.min(i || 0, itens.length - 1));
    mostrarLb();
    lb.hidden = false;
    document.documentElement.classList.add('bm-lb-aberto');
    try { history.pushState({ bmModal: 'fotos' }, ''); lbHistorico = true; } catch (e) { lbHistorico = false; }
    var x = lb.querySelector('.bm-lb-x'); if (x) x.focus();
  }
  function fecharLb() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    document.documentElement.classList.remove('bm-lb-aberto');
    if (lbHistorico) { lbHistorico = false; try { history.back(); } catch (e) {} }
  }
  function moverLb(d) {
    if (lbItens.length < 2) return;
    lbIndice = (lbIndice + d + lbItens.length) % lbItens.length;
    mostrarLb();
  }

  function ligarFotos() {
    document.addEventListener('click', function (e) {
      var alvo = e.target.closest ? e.target.closest('[data-lb-grupo],[data-lb-review]') : null;
      if (alvo) {
        if (alvo.hasAttribute('data-lb-review')) {
          var r = REVIEWS[parseInt(alvo.getAttribute('data-lb-review'), 10)];
          abrirLb(itensFotos([r]), parseInt(alvo.getAttribute('data-lb-j'), 10) || 0);
        } else {
          var grupo = alvo.getAttribute('data-lb-grupo');
          var fonte = grupo === 'destaques' ? DESTAQUES : ORDENADAS.map(function (o) { return o.r; });
          var itens = grupo === 'destaques'
            ? DESTAQUES.map(function (r) { return itensFotos([r])[0]; }).filter(Boolean)
            : itensFotos(fonte);
          /* nos destaques, o índice é o do card; só cards com foto viram botão */
          abrirLb(itens, grupo === 'destaques'
            ? DESTAQUES.slice(0, parseInt(alvo.getAttribute('data-lb-i'), 10)).filter(function (r) { return fotosDe(r).length; }).length
            : parseInt(alvo.getAttribute('data-lb-i'), 10) || 0);
        }
        return;
      }
      /* galeria "Veja de perto" */
      var img = e.target.closest ? e.target.closest('.bm-foto > img') : null;
      if (img) {
        var figuras = Array.prototype.filter.call(document.querySelectorAll('#bm-galeria .bm-foto > img'), function (el) {
          return el.offsetParent !== null;
        });
        var itensG = figuras.map(function (el) {
          var cap = el.parentNode.querySelector('figcaption');
          return { src: el.currentSrc || el.src, alt: el.alt, legenda: cap ? cap.textContent : '' };
        });
        abrirLb(itensG, figuras.indexOf(img));
      }
    });

    /* setas da galeria (computador) */
    var trilho = document.getElementById('bm-galeria');
    each(document.querySelectorAll('[data-galeria]'), function (b) {
      b.addEventListener('click', function () {
        if (!trilho) return;
        var fig = trilho.querySelector('.bm-foto:not([data-vazio])');
        var passo = fig ? fig.getBoundingClientRect().width + 12 : trilho.clientWidth * 0.8;
        var d = parseInt(b.getAttribute('data-galeria'), 10);
        try { trilho.scrollBy({ left: d * passo, behavior: 'smooth' }); } catch (err) { trilho.scrollLeft += d * passo; }
      });
    });
    each(document.querySelectorAll('#bm-galeria .bm-foto > img'), function (img) { img.style.cursor = 'zoom-in'; });
  }

  /* ================================================================
     seletor da oferta e resumo do pedido
     ================================================================ */
  var estado = { opcao: 'kit', escolhas: [] };

  var elSlots = document.getElementById('bm-slots');
  var elUpsell = document.getElementById('bm-upsell');
  var elLista = document.getElementById('bm-resumo-lista');
  var elLinhas = document.getElementById('bm-resumo-linhas');
  var elTotal = document.getElementById('bm-resumo-total');
  var elAviso = document.getElementById('bm-aviso');
  var elFinal = document.getElementById('bm-finalizar');

  function quantidade() { return qtdDe(estado.opcao); }

  function montarSlots() {
    if (!elSlots) return;
    elSlots.innerHTML = '';
    if (estado.opcao === 'kit') return;
    var qtd = quantidade();
    var titulo = document.createElement('p');
    titulo.className = 'bm-slot-titulo';
    titulo.innerHTML = (qtd === 1 ? 'Escolha a fragrância' : 'Escolha 2 fragrâncias diferentes') +
      ' <span>' + estado.escolhas.length + ' de ' + qtd + '</span>';
    elSlots.appendChild(titulo);

    var grade = document.createElement('div');
    grade.className = 'bm-escolhas';
    each(ORDEM, function (chave) {
      var f = FRAGRANCIAS[chave];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bm-escolha';
      b.setAttribute('data-ac', chave);
      b.setAttribute('aria-pressed', estado.escolhas.indexOf(chave) !== -1 ? 'true' : 'false');
      b.innerHTML = '<img src="' + f.img + '" alt="" width="24" height="64" loading="lazy">' + f.nome + '<small>' + f.perfil + '</small>';
      b.addEventListener('click', function () { escolher(chave); });
      grade.appendChild(b);
    });
    elSlots.appendChild(grade);
  }

  function escolher(chave) {
    var qtd = quantidade();
    var pos = estado.escolhas.indexOf(chave);
    if (qtd === 1) estado.escolhas = [chave];
    else if (pos !== -1) estado.escolhas.splice(pos, 1);
    else {
      estado.escolhas.push(chave);
      if (estado.escolhas.length > qtd) estado.escolhas.shift();
    }
    if (elAviso) elAviso.textContent = '';
    atualizar();
  }

  function linhaResumo(rotulo, valor, classe) {
    return '<div class="' + (classe || '') + '"><span>' + rotulo + '</span><b>' + valor + '</b></div>';
  }

  function atualizarResumo() {
    var kit = estado.opcao === 'kit';
    var qtd = quantidade();
    var itens = kit ? ORDEM.slice() : estado.escolhas.slice(0, qtd);
    var html = '';
    each(itens, function (chave) {
      html += '<li><span>Bodyman ' + FRAGRANCIAS[chave].nome + '</span><span>200 ml</span></li>';
    });
    for (var i = itens.length; i < qtd; i++) {
      html += '<li data-vazio="true"><span>Fragrância ' + (i + 1) + ' — escolha acima</span><span>200 ml</span></li>';
    }
    if (elLista) elLista.innerHTML = html;

    var linhas = linhaResumo('Quantidade', qtd + (qtd > 1 ? ' frascos' : ' frasco') + ' · ' + (qtd * 200) + ' ml');
    if (qtd > 1) linhas += linhaResumo('Desconto do kit', '−' + brl(economia(estado.opcao)), 'bm-eco');
    linhas += linhaResumo('Frete', qtd >= CONFIG.FREE_SHIPPING_MIN_ITEMS ? '<span class="bm-gratis">Grátis</span>' : 'Calculado no checkout');
    if (elLinhas) elLinhas.innerHTML = linhas;
    if (elTotal) elTotal.textContent = brl(precoDe(estado.opcao));
    if (elFinal) elFinal.textContent = 'Finalizar compra — ' + brl(precoDe(estado.opcao));
  }

  function atualizarSticky() {
    var titulo = document.getElementById('bm-sticky-titulo');
    var sub = document.getElementById('bm-sticky-sub');
    var btn = document.getElementById('bm-sticky-btn');
    if (!titulo) return;
    var qtd = quantidade();
    titulo.textContent = NOME_OPCAO[estado.opcao] + ' · ' + brl(precoDe(estado.opcao));
    sub.textContent = estado.opcao === 'kit'
      ? '3 frascos · 600 ml · frete grátis'
      : qtd + (qtd > 1 ? ' frascos · ' : ' frasco · ') + (qtd * 200) + ' ml · frete grátis';
    btn.textContent = estado.opcao === 'kit' ? 'Quero meu kit' : 'Comprar agora';
  }

  function atualizar() {
    each(document.querySelectorAll('.bm-opcao[data-opcao]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-opcao') === estado.opcao ? 'true' : 'false');
    });
    if (elUpsell) elUpsell.hidden = estado.opcao !== '2';
    montarSlots();
    atualizarResumo();
    atualizarSticky();
  }

  function selecionar(op, cta) {
    if (!PRECO[op]) return;
    if (op !== estado.opcao) {
      estado.opcao = op;
      estado.escolhas = estado.escolhas.slice(0, qtdDe(op) === 3 ? 0 : qtdDe(op));
    }
    atualizar();
    BM.track('select_offer', { offer: PLANO_POR_OPCAO[op], value: precoDe(op), num_items: qtdDe(op), cta: cta || 'seletor' });
  }

  function pedidoAtual() {
    var itens = estado.opcao === 'kit' ? ORDEM.slice() : estado.escolhas.slice(0, quantidade());
    return {
      plan: PLANO_POR_OPCAO[estado.opcao],
      produtos: itens,
      frascos: quantidade(),
      volumeMl: quantidade() * 200,
      total: Math.round(precoDe(estado.opcao) * 100),   // centavos
      completo: itens.length === quantidade()
    };
  }

  function irPara(id, bloco) {
    var el = document.getElementById(id);
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: bloco || 'start' }); } catch (e) { el.scrollIntoView(); }
  }
  function irParaOferta() { irPara('bm-resumo', 'start'); }

  function avisoFalta() {
    var falta = quantidade() - estado.escolhas.length;
    if (elAviso) elAviso.textContent = falta === 1 ? 'Escolha mais 1 fragrância para continuar.' : 'Escolha ' + falta + ' fragrâncias para continuar.';
    irPara('bm-slots', 'center');
  }

  function checkoutIndisponivel() {
    if (!elAviso) return;
    elAviso.innerHTML = 'Não conseguimos abrir o pagamento agora. Tente novamente em instantes ou ' +
      '<a href="' + (BM.whatsLink ? BM.whatsLink('Olá! Quero comprar o ' + NOME_OPCAO[estado.opcao] + ' Bodyman pelo site, mas o pagamento não abriu.') : '#atendimento') +
      '" target="_blank" rel="noopener">finalize pelo WhatsApp</a>.';
    irParaOferta();
  }

  function abrirCheckout(cta) {
    var pedido = pedidoAtual();
    if (!pedido.completo) { irParaOferta(); avisoFalta(); return; }
    if (CONFIG.CHECKOUT_URL) { window.location.href = CONFIG.CHECKOUT_URL; return; }
    pedido.cta = cta || '';
    if (window.BodymanCheckout && typeof window.BodymanCheckout.abrir === 'function') {
      try { window.BodymanCheckout.abrir(pedido); return; } catch (e) { if (window.console) console.error('[bodyman] checkout', e); }
    }
    checkoutIndisponivel();
  }

  function ligarCompra() {
    each(document.querySelectorAll('.bm-opcao[data-opcao]'), function (b) {
      b.addEventListener('click', function () { selecionar(b.getAttribute('data-opcao'), 'seletor'); });
    });

    document.addEventListener('click', function (e) {
      var alvo = e.target.closest ? e.target.closest('[data-acao]') : null;
      if (!alvo) return;
      var acao = alvo.getAttribute('data-acao');
      var cta = alvo.getAttribute('data-cta') || acao;

      if (acao === 'kit') {
        e.preventDefault();
        BM.track('click_buy', { cta: cta, offer: 'triple', value: CONFIG.TRIPLE_PRICE });
        selecionar('kit', cta);
        abrirCheckout(cta);
      } else if (acao === 'kit-selecionar') {
        selecionar('kit', 'upsell');
      } else if (acao === 'oferta') {
        e.preventDefault();
        BM.track('click_options', { cta: cta });
        irParaOferta();
      } else if (acao === 'sticky') {
        BM.track('click_buy', { cta: 'sticky', offer: PLANO_POR_OPCAO[estado.opcao], value: precoDe(estado.opcao) });
        if (pedidoAtual().completo) { BM.track('select_offer', { offer: PLANO_POR_OPCAO[estado.opcao], value: precoDe(estado.opcao), num_items: quantidade(), cta: 'sticky' }); abrirCheckout('sticky'); }
        else { irParaOferta(); avisoFalta(); }
      }
    });

    if (elFinal) elFinal.addEventListener('click', function () {
      BM.track('click_buy', { cta: 'oferta', offer: PLANO_POR_OPCAO[estado.opcao], value: precoDe(estado.opcao) });
      if (!pedidoAtual().completo) { avisoFalta(); return; }
      BM.track('select_offer', { offer: PLANO_POR_OPCAO[estado.opcao], value: precoDe(estado.opcao), num_items: quantidade(), cta: 'oferta' });
      abrirCheckout('oferta');
    });
  }

  /* ================================================================
     barra fixa do celular: aparece quando nenhum botão de compra está
     na tela e some com o checkout aberto
     ================================================================ */
  function ligarSticky() {
    var barra = document.getElementById('bm-sticky');
    if (!barra) return;
    var visiveis = {};
    var alvos = [document.getElementById('bm-cta-hero'), elFinal].filter(Boolean);
    each(alvos, function (el) { visiveis[el.id] = true; });

    function aplicar() {
      var algumVisivel = false;
      for (var k in visiveis) if (visiveis[k]) algumVisivel = true;
      var aberto = document.documentElement.classList.contains('bm-co-aberto');
      var mostrar = !algumVisivel && !aberto && window.innerWidth < 961;
      barra.setAttribute('data-visivel', mostrar ? 'true' : 'false');
      document.documentElement.classList.toggle('bm-com-barra', mostrar);
    }

    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entradas) {
        each(entradas, function (en) { visiveis[en.target.id] = en.isIntersecting; });
        aplicar();
      }, { threshold: 0.5 });
      each(alvos, function (el) { obs.observe(el); });
    } else {
      window.addEventListener('scroll', function () {
        each(alvos, function (el) {
          var r = el.getBoundingClientRect();
          visiveis[el.id] = r.top < window.innerHeight && r.bottom > 0;
        });
        aplicar();
      }, { passive: true });
    }
    window.addEventListener('resize', aplicar);
    window.addEventListener('bodyman:checkout_estado', aplicar);
  }

  /* ================================================================
     início — cada etapa isolada: uma falha não derruba as outras
     ================================================================ */
  BM.seguro('valores', preencherValores);
  BM.seguro('envio', aplicarEnvio);
  BM.seguro('nota', aplicarNota);
  BM.seguro('destaques', montarDestaques);
  BM.seguro('avaliacoes', renderAvaliacoes);
  BM.seguro('fotos', ligarFotos);
  BM.seguro('oferta', atualizar);
  BM.seguro('compra', ligarCompra);
  BM.seguro('sticky', ligarSticky);
  setInterval(function () { BM.seguro('envio', aplicarEnvio); }, 60000);

  BM.track('view_product', { offer: 'triple', value: CONFIG.TRIPLE_PRICE, num_items: 3 });

  /* superfície pública usada pelo checkout.js */
  window.BODYMAN = {
    pedidoAtual: pedidoAtual,
    statusEnvio: BM.envio ? BM.envio.status : function () { return { noPrazo: false, ligado: false }; },
    rotuloCorte: BM.envio ? BM.envio.rotuloCorte : function () { return '12h'; },
    brl: brl,
    nomeOpcao: function () { return NOME_OPCAO[estado.opcao]; },
    irParaOferta: irParaOferta,
    selecionar: selecionar
  };
})();
