(function(){
  "use strict";

  /* ================================================================
     CONFIGURAÇÃO — altere somente aqui para mudar preços e dados.
     Todos os textos da página (cards, seletor, resumo, CTAs, barra
     fixa do mobile) são calculados a partir destas constantes.
     ================================================================ */
  var CONFIG = {
    SINGLE_PRICE: 49.90,   // 1 frasco
    DOUBLE_PRICE: 79.90,   // 2 frascos
    TRIPLE_PRICE: 97.00,   // kit com 3

    PREVIOUS_SALES: 4000,  // histórico do canal/site anterior
    AVERAGE_RATING: 4.8,   // avaliação média (não arredondar para 5)

    LAUNCH_BAR_MESSAGE: '🔥 Oferta de lançamento — condições especiais no estoque promocional',
    STOCK_BADGE: 'Estoque promocional limitado',

    /* Deixe vazio para não exibir. Só preencha se a informação for real.
       Ex.: 'Estoque promocional próximo do fim' */
    PROMOTIONAL_STOCK_MESSAGE: '',

    /* ---- envio no mesmo dia ----
       Horário e fuso da operação. Sábados, domingos e as datas listadas
       em SAME_DAY_SHIPPING_HOLIDAYS não são considerados dias úteis. */
    SAME_DAY_SHIPPING_ENABLED: true,
    SAME_DAY_SHIPPING_CUTOFF: '12:00',
    SAME_DAY_SHIPPING_TIMEZONE: 'America/Sao_Paulo',
    SAME_DAY_SHIPPING_HOLIDAYS: [],       // ex.: ['2026-12-25','2027-01-01']
    SAME_DAY_SHIPPING_COUNTDOWN: true,    // mostra quanto falta para o corte

    /* Frete grátis a partir de quantos frascos. O briefing só confirma
       frete grátis no kit com 3; mude para 1 se valer para todos. */
    FREE_SHIPPING_MIN_ITEMS: 3,

    /* URL do checkout. Vazio = apenas registra a seleção no console. */
    CHECKOUT_URL: ''
  };

  /* ================================================================
     AVALIAÇÕES DOS CLIENTES

     Campos: name, initials (iniciais do avatar), age, rating (1 a 5),
     product, text.

     Opcionais:
       date: '2026-09-10'  -> exibe "há X dias", calculado automaticamente
       verified: true      -> exibe o selo "Compra verificada"

     Sem o campo date, o card não mostra informação de tempo.
     ================================================================ */
  var REAL_REVIEWS = [
    { name:'Lucas Andrade', initials:'LA', age:23, rating:5, product:'Kit Completo',
      text:'Peguei o kit com os três e valeu demais. O Enigma virou meu favorito, mas os três são bem diferentes entre si. Na minha pele senti o cheiro por umas 5 horas tranquilo. Pelo preço do trio, achei muito bom.' },
    { name:'Rafael Mendes', initials:'RM', age:31, rating:5, product:'Kit Completo',
      text:'Chegou rápido e muito bem embalado. Gostei bastante da proposta de ter três fragrâncias pra momentos diferentes. Barbarius é mais forte, Midtown é mais suave e Enigma fica no meio. Kit completo vale muito mais a pena.' },
    { name:'Bruno Carvalho', initials:'BC', age:27, rating:5, product:'Kit Completo',
      text:'Pelo preço eu tava esperando algo mais simples, mas me surpreendeu. Frasco grande de 200 ml e cheiro bem agradável. Em mim a fixação ficou perto de 4 a 5 horas. Compraria novamente.' },
    { name:'Gustavo Lima', initials:'GL', age:38, rating:5, product:'Kit Completo',
      text:'Comprei o trio e não me arrependo. Uso um no trabalho, outro pra sair e outro no dia a dia. A variedade é o melhor do kit. Veio tudo certinho e bem protegido.' },
    { name:'Mateus Rocha', initials:'MR', age:21, rating:4, product:'Midtown',
      text:'Curti bastante. Meu favorito foi o Midtown porque é mais limpo e fácil de usar todo dia. A duração na minha pele ficou em torno de 4 horas. Pelo valor, achei justo demais.' },
    { name:'Diego Martins', initials:'DM', age:34, rating:5, product:'Kit Completo',
      text:'Barbarius é absurdo de bom pra noite. Tem uma pegada mais marcante e diferente. O kit com três compensa porque você não fica preso em uma fragrância só. Chegou bem rápido aqui.' },
    { name:'Felipe Souza', initials:'FS', age:29, rating:5, product:'Enigma',
      text:'Já tinha usado body splash antes, mas esses me surpreenderam. O Enigma ficou umas 5 horas na minha pele e ainda dava pra sentir de perto depois. Gostei bastante da embalagem também.' },
    { name:'André Ribeiro', initials:'AR', age:42, rating:5, product:'Kit Completo',
      text:'Gostei da apresentação e principalmente do custo-benefício. São três frascos grandes e cada um tem uma proposta diferente. Pra quem gosta de variar perfume, faz bastante sentido.' },
    { name:'Caio Fernandes', initials:'CF', age:19, rating:5, product:'Kit Completo',
      text:'Kit muito bom pelo preço. Eu e meu irmão já estamos disputando o Barbarius kkk. Cheiro forte na medida e na minha pele durou perto de 6 horas.' },
    { name:'Eduardo Nunes', initials:'EN', age:45, rating:5, product:'Kit Completo',
      text:'Produto chegou bem embalado, sem vazamento e dentro do esperado. Gostei mais do Enigma, tem um cheiro elegante e fácil de usar. O trio foi uma boa compra.' },
    { name:'Henrique Alves', initials:'HA', age:26, rating:5, product:'Kit Completo',
      text:'Eu ia pegar só dois, mas pela diferença de preço preferi levar os três. Ainda bem que fiz isso, porque o Midtown que eu achava que seria o que menos usaria acabou sendo um dos melhores.' },
    { name:'Marcelo Costa', initials:'MC', age:52, rating:4, product:'Kit Completo',
      text:'Boa variedade de fragrâncias e frascos com ótimo tamanho. Não são todos iguais, cada um tem um estilo bem próprio. Em mim a duração ficou em torno de 4 horas, o que achei bom para body splash.' },
    { name:'João Pedro Santos', initials:'JS', age:24, rating:5, product:'Kit Completo',
      text:'O kit completo é disparado a melhor opção. Três body splash de 200 ml por esse valor compensa demais. Chegou rápido e tudo bem protegido.' },
    { name:'Thiago Moreira', initials:'TM', age:36, rating:5, product:'Kit Completo',
      text:'O Barbarius foi o que mais gostei. Mais intenso e com presença. O Enigma também é muito bom pra usar à noite. No meu caso ficaram umas 5 horas perceptíveis.' },
    { name:'Leonardo Freitas', initials:'LF', age:28, rating:5, product:'Kit Completo',
      text:'Gostei porque não parece que você comprou três cheiros iguais com rótulos diferentes. Cada um tem uma identidade. Pelo preço do combo, achei excelente.' },
    { name:'Rodrigo Teixeira', initials:'RT', age:41, rating:5, product:'Midtown',
      text:'Recebi antes do que esperava e veio tudo muito bem embalado. O Midtown é ótimo pra usar no trabalho porque é mais discreto e sofisticado. Vou comprar o kit novamente quando acabar.' },
    { name:'Vinícius Barros', initials:'VB', age:22, rating:5, product:'Enigma',
      text:'Pra mim o Enigma ganhou fácil. Cheiro muito bom e fixa legal. Passei de manhã e umas 4 a 5 horas depois ainda sentia na pele. O trio compensa demais.' },
    { name:'Alexandre Moraes', initials:'AM', age:48, rating:4, product:'Kit Completo',
      text:'Bom custo-benefício. Os frascos são grandes e o kit permite variar bastante. Gostei especialmente do Midtown. Entrega rápida e embalagem bem feita.' },
    { name:'Murilo Cardoso', initials:'MC', age:33, rating:5, product:'Kit Completo',
      text:'Comprei pela promoção do trio e achei que valeu cada real. O Barbarius é mais intenso, Enigma mais elegante e Midtown mais versátil. Uso os três dependendo da ocasião.' },
    { name:'Daniel Pires', initials:'DP', age:57, rating:5, product:'Kit Completo',
      text:'Gostei bastante da qualidade geral. Boa apresentação, fragrâncias agradáveis e quantidade excelente. Na minha pele a duração ficou perto de 5 horas. Pelo valor do kit completo, achei uma ótima compra.' }
  ];

  var AVALIACOES = REAL_REVIEWS;

  /* ---------------- fragrâncias (conteúdo do material do produto) ---------------- */
  var FRAGRANCIAS = {
    enigma: {
      nome:'Enigma', ac:'enigma', volume:'200 ml',
      curta:'Cítrico, aromático e amadeirado.',
      familia:'Amadeirado especiado',
      perfil:'Aromático • Refrescante',
      completa:'Enigma é o Bodyman da autoconfiança masculina. Uma combinação envolvente de notas cítricas vibrantes com um fundo amadeirado sofisticado. O frescor das notas cítricas encontra um fundo amadeirado mais sofisticado, criando um aroma moderno e envolvente.'
    },
    midtown: {
      nome:'Midtown', ac:'midtown', volume:'200 ml',
      curta:'Fresco, urbano e sofisticado.',
      familia:'Amadeirado floral almiscarado',
      perfil:'Urbano • Sofisticado',
      completa:'Combina frescor aromático com um toque amadeirado sofisticado, resultando em um aroma marcante, limpo e versátil, ideal para quem vive a rotina agitada da cidade e quer deixar uma assinatura discreta, porém inesquecível.'
    },
    barbarius: {
      nome:'Barbarius', ac:'barbarius', volume:'200 ml',
      curta:'Bergamota, especiarias e notas amadeiradas.',
      familia:'Aromático fougère',
      perfil:'Intenso • Magnético',
      completa:'Abre com um frescor explosivo de bergamota, contrastando com notas picantes e amadeiradas que criam um rastro magnético e inconfundível. Transmite liberdade, intensidade e presença.'
    }
  };

  var ORDEM = ['enigma','midtown','barbarius'];
  var estado = { opcao:'kit', escolhas:[null,null] };

  /* ---------------- cálculos ---------------- */
  var PRECO = { '1':CONFIG.SINGLE_PRICE, '2':CONFIG.DOUBLE_PRICE, 'kit':CONFIG.TRIPLE_PRICE };

  function brl(v){ return 'R$ ' + v.toFixed(2).replace('.', ','); }
  function qtdDe(op){ return op === 'kit' ? 3 : parseInt(op,10); }
  function quantidade(){ return qtdDe(estado.opcao); }
  function precoDe(op){ return PRECO[op]; }
  function precoAvulso(op){ return CONFIG.SINGLE_PRICE * qtdDe(op); }      // valor comprando separado
  function precoUnitario(op){ return PRECO[op] / qtdDe(op); }
  function economia(op){ return precoAvulso(op) - PRECO[op]; }
  var DIFERENCA_2_PARA_3 = CONFIG.TRIPLE_PRICE - CONFIG.DOUBLE_PRICE;

  var MAPA = { single:'1', double:'2', triple:'kit' };

  function preencherValores(){
    document.querySelectorAll('[data-preco]').forEach(function(el){
      el.textContent = brl(precoDe(MAPA[el.getAttribute('data-preco')]));
    });
    document.querySelectorAll('[data-unit]').forEach(function(el){
      el.textContent = brl(precoUnitario(MAPA[el.getAttribute('data-unit')]));
    });
    document.querySelectorAll('[data-econ]').forEach(function(el){
      el.textContent = brl(economia(MAPA[el.getAttribute('data-econ')]));
    });
    document.querySelectorAll('[data-de]').forEach(function(el){
      el.textContent = brl(precoAvulso(MAPA[el.getAttribute('data-de')]));
    });
    document.querySelectorAll('[data-diff]').forEach(function(el){
      el.textContent = brl(DIFERENCA_2_PARA_3);
    });
  }

  /* ---------------- lançamento e prova social ---------------- */
  function preencherLancamento(){
    document.getElementById('bm-topbar').textContent = CONFIG.LAUNCH_BAR_MESSAGE;
    document.getElementById('bm-badge-estoque').textContent = CONFIG.STOCK_BADGE;

    var aviso = document.getElementById('bm-badge-aviso');
    if(CONFIG.PROMOTIONAL_STOCK_MESSAGE){
      aviso.textContent = CONFIG.PROMOTIONAL_STOCK_MESSAGE;
      aviso.hidden = false;
    }
  }

  function preencherProvaSocial(){
    var v = CONFIG.PREVIOUS_SALES;
    document.getElementById('bm-vendas').textContent = '+' + v.toLocaleString('pt-BR');
    document.getElementById('bm-nota').textContent =
      CONFIG.AVERAGE_RATING.toFixed(1).replace('.', ',') + ' / 5';
    var stars = document.getElementById('bm-stars');
    stars.querySelector('i').textContent = '★★★★★';
    stars.querySelector('i').style.width = (CONFIG.AVERAGE_RATING / 5 * 100) + '%';
  }

  /* ---------------- envio no mesmo dia ---------------- */
  function agoraOperacao(){
    try{
      return new Date(new Date().toLocaleString('en-US', { timeZone: CONFIG.SAME_DAY_SHIPPING_TIMEZONE }));
    }catch(e){ return new Date(); }
  }

  function minutosCorte(){
    var p = String(CONFIG.SAME_DAY_SHIPPING_CUTOFF || '12:00').split(':');
    return (parseInt(p[0],10) || 0) * 60 + (parseInt(p[1],10) || 0);
  }

  function rotuloCorte(){
    var p = String(CONFIG.SAME_DAY_SHIPPING_CUTOFF || '12:00').split(':');
    var h = parseInt(p[0],10) || 0, m = parseInt(p[1],10) || 0;
    return m ? (h + 'h' + (m < 10 ? '0' + m : m)) : (h + 'h');
  }

  function dataISO(d){
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth()+1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function ehDiaUtil(d){
    var s = d.getDay();
    if(s === 0 || s === 6) return false;
    return (CONFIG.SAME_DAY_SHIPPING_HOLIDAYS || []).indexOf(dataISO(d)) === -1;
  }

  function statusEnvio(){
    var d = agoraOperacao();
    var min = d.getHours() * 60 + d.getMinutes();
    var corte = minutosCorte();
    return { noPrazo: ehDiaUtil(d) && min < corte, faltam: corte - min };
  }

  function textoFaltam(min){
    if(min <= 0) return '';
    var h = Math.floor(min/60), m = min % 60;
    if(h > 0) return 'faltam ' + h + 'h' + (m ? (m < 10 ? '0'+m : m) : '');
    return 'falta' + (m === 1 ? '' : 'm') + ' ' + m + ' min';
  }

  function aplicarEnvio(){
    var ligado = CONFIG.SAME_DAY_SHIPPING_ENABLED;
    var alvos = document.querySelectorAll('[data-envio-linha],[data-envio-card],[data-envio-caixa],[data-envio-rodape]');
    Array.prototype.forEach.call(alvos, function(el){ el.hidden = !ligado; });
    if(!ligado) return;

    document.querySelectorAll('[data-corte]').forEach(function(el){ el.textContent = rotuloCorte(); });

    var st = statusEnvio();
    var restante = (CONFIG.SAME_DAY_SHIPPING_COUNTDOWN && st.noPrazo) ? textoFaltam(st.faltam) : '';

    var hero = document.querySelector('[data-envio-hero]');
    if(hero){
      hero.textContent = st.noPrazo
        ? 'Peça até às ' + rotuloCorte() + ' para postagem ainda hoje' + (restante ? ' (' + restante + ')' : '') + '*'
        : 'Postagem em até 1 dia útil após a confirmação do pagamento';
    }

    var resumo = document.querySelector('[data-envio-resumo]');
    if(resumo){
      resumo.textContent = st.noPrazo
        ? 'Pedidos até às ' + rotuloCorte() + ' saem no mesmo dia*' + (restante ? ' — ' + restante : '')
        : 'Postagem em até 1 dia útil*';
    }

    var kit = document.querySelector('[data-envio-kit]');
    if(kit){
      kit.textContent = 'Postagem no mesmo dia para pagamentos confirmados até às ' +
        rotuloCorte() + ' em dias úteis';
    }
  }

  /* ---------------- carrossel de avaliações ---------------- */
  var CORES_AVATAR = ['#8FC6E8','#CFC7B7','#7FD3A6','#E8A87C','#B9A7E0','#6FB3DC'];

  function estrelas(nota){
    return '<span class="bm-stars" aria-label="' + nota + ' de 5">★★★★★' +
           '<i style="width:' + (Math.max(0,Math.min(5,nota))/5*100) + '%">★★★★★</i></span>';
  }

  function tempoRelativo(iso){
    var d = new Date(iso);
    if(isNaN(d)) return '';
    var dias = Math.floor((Date.now() - d.getTime()) / 86400000);
    if(dias <= 0) return 'hoje';
    if(dias === 1) return 'há 1 dia';
    if(dias < 30) return 'há ' + dias + ' dias';
    var meses = Math.floor(dias/30);
    return meses === 1 ? 'há 1 mês' : 'há ' + meses + ' meses';
  }

  function escapar(t){
    return String(t == null ? '' : t)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function cardAvaliacao(r, i){
    var quando = r.relativeTime || (r.date ? tempoRelativo(r.date) : '');
    var meta = [r.age ? r.age + ' anos' : '', quando].filter(Boolean).join(' · ');
    var iniciais = r.initials || (r.name || '').split(' ').filter(Boolean)
                     .slice(0,2).map(function(p){ return p[0]; }).join('').toUpperCase();
    return '<article class="bm-depo-card">' +
      '<div class="bm-depo-topo">' +
        '<span class="bm-avatar" style="--c:' + CORES_AVATAR[i % CORES_AVATAR.length] + '" aria-hidden="true">' + escapar(iniciais) + '</span>' +
        '<div style="flex:1">' +
          '<p class="bm-depo-nome">' + escapar(r.name) + '</p>' +
          '<p class="bm-depo-meta">' + escapar(meta) + '</p>' +
        '</div>' +
        (r.verified && !r.demo ? '<span class="bm-verificada">Compra verificada</span>' : '') +
      '</div>' +
      estrelas(r.rating || 5) +
      '<p class="bm-depo-texto">' + escapar(r.text) + '</p>' +
      (r.product ? '<p class="bm-depo-produto">' + escapar(r.product) + '</p>' : '') +
    '</article>';
  }

  var carEl   = document.getElementById('bm-carrossel');
  var trackEl = document.getElementById('bm-track');
  var dotsEl  = document.getElementById('bm-dots');
  var secaoDepo = document.getElementById('bm-depo');

  var idx = 0, passo = 0, visiveis = 3, totalCards = 0;
  var timer = null, pausado = false, retomar = null;
  var arrastando = false, x0 = 0, dx = 0;

  function visiveisAgora(){
    return window.innerWidth >= 980 ? 3 : (window.innerWidth >= 680 ? 2 : 1);
  }

  function aplicar(anim){
    trackEl.style.transition = anim ? 'transform .62s cubic-bezier(.3,.72,.2,1)' : 'none';
    trackEl.style.transform = 'translate3d(' + (-idx * passo) + 'px,0,0)';
    var cards = trackEl.children, meio = idx + Math.floor(visiveis/2);
    for(var i=0;i<cards.length;i++){
      cards[i].classList.toggle('bm-depo-card--destaque', visiveis === 3 && i === meio);
    }
    var pontos = dotsEl.children, ativo = ((idx % totalCards) + totalCards) % totalCards;
    for(var j=0;j<pontos.length;j++){
      pontos[j].setAttribute('aria-current', j === ativo ? 'true' : 'false');
    }
  }

  function proximo(){
    idx++; aplicar(true);
    if(idx >= totalCards){
      setTimeout(function(){ idx = 0; aplicar(false); }, 640);
    }
  }

  function anterior(){
    if(idx <= 0){
      idx = totalCards; aplicar(false);
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ idx--; aplicar(true); }); });
    }else{ idx--; aplicar(true); }
  }

  function iniciarAuto(){
    if(timer) clearInterval(timer);
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer = setInterval(function(){
      if(!pausado && !arrastando && document.visibilityState === 'visible') proximo();
    }, 5000);
  }

  function pausarUmPouco(){
    pausado = true;
    if(retomar) clearTimeout(retomar);
    retomar = setTimeout(function(){ pausado = false; }, 10000);
  }

  function medir(){
    var card = trackEl.firstElementChild;
    if(!card) return;
    var gap = parseFloat(getComputedStyle(trackEl).columnGap || 18) || 18;
    passo = card.getBoundingClientRect().width + gap;
  }

  function montarCarrossel(){
    if(!AVALIACOES.length){ secaoDepo.hidden = true; return; }
    secaoDepo.hidden = false;

    visiveis = visiveisAgora();
    totalCards = AVALIACOES.length;

    var html = AVALIACOES.map(cardAvaliacao).join('');
    for(var c=0;c<visiveis;c++){                       /* clones = loop infinito */
      html += cardAvaliacao(AVALIACOES[c % totalCards], c);
    }
    trackEl.innerHTML = html;

    dotsEl.innerHTML = AVALIACOES.map(function(_, i){
      return '<button type="button" class="bm-dot" data-i="' + i + '" aria-label="Avaliação ' + (i+1) + '"></button>';
    }).join('');

    idx = 0; medir(); aplicar(false); iniciarAuto();
  }

  /* cabeçalho: nota e vendas acumuladas */
  function preencherCabecalhoDepo(){
    var st = secaoDepo.querySelector('.bm-depo-resumo .bm-stars i');
    if(st){ st.textContent = '★★★★★'; st.style.width = (CONFIG.AVERAGE_RATING/5*100) + '%'; }
    document.getElementById('bm-depo-nota').textContent =
      CONFIG.AVERAGE_RATING.toFixed(1).replace('.', ',') + '/5';
    document.getElementById('bm-depo-vendas').textContent =
      '+' + CONFIG.PREVIOUS_SALES.toLocaleString('pt-BR') + ' vendas acumuladas';
  }

  function ligarCarrossel(){
    carEl.addEventListener('mouseenter', function(){ pausado = true; });
    carEl.addEventListener('mouseleave', function(){ if(!retomar) pausado = false; });

    carEl.querySelectorAll('.bm-seta').forEach(function(b){
      b.addEventListener('click', function(){
        pausarUmPouco();
        b.getAttribute('data-dir') === '1' ? proximo() : anterior();
      });
    });

    dotsEl.addEventListener('click', function(e){
      var b = e.target.closest('.bm-dot');
      if(!b) return;
      pausarUmPouco(); idx = parseInt(b.getAttribute('data-i'),10); aplicar(true);
    });

    trackEl.addEventListener('pointerdown', function(e){
      arrastando = true; x0 = e.clientX; dx = 0;
      trackEl.style.transition = 'none';
      trackEl.setPointerCapture(e.pointerId);
    });
    trackEl.addEventListener('pointermove', function(e){
      if(!arrastando) return;
      dx = e.clientX - x0;
      trackEl.style.transform = 'translate3d(' + (-idx * passo + dx) + 'px,0,0)';
    });
    function soltar(){
      if(!arrastando) return;
      arrastando = false; pausarUmPouco();
      if(dx < -45) proximo();
      else if(dx > 45) anterior();
      else aplicar(true);
      dx = 0;
    }
    trackEl.addEventListener('pointerup', soltar);
    trackEl.addEventListener('pointercancel', soltar);

    var t;
    window.addEventListener('resize', function(){
      clearTimeout(t);
      t = setTimeout(function(){
        var v = visiveisAgora();
        if(v !== visiveis) montarCarrossel(); else { medir(); aplicar(false); }
      }, 180);
    });
  }

  function renderAvaliacoes(){
    if(!secaoDepo) return;
    var btn = document.getElementById('bm-ver-avaliacoes');
    preencherCabecalhoDepo();
    montarCarrossel();
    if(AVALIACOES.length){
      ligarCarrossel();
      if(btn) btn.addEventListener('click', function(){
        secaoDepo.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    }else if(btn){
      btn.parentNode.hidden = true;     /* sem avaliações, sem botão */
    }
  }

  /* ---------------- parallax discreto do hero (só desktop) ---------------- */
  function ligarParallax(){
    var area = document.getElementById('bm-hero-frascos');
    if(!area) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if(!window.matchMedia('(hover: hover) and (min-width: 901px)').matches) return;

    var frascos = area.querySelectorAll('.bm-hf');
    var pendente = false, px = 0, py = 0;

    window.addEventListener('mousemove', function(e){
      px = (e.clientX / window.innerWidth) - 0.5;
      py = (e.clientY / window.innerHeight) - 0.5;
      if(pendente) return;
      pendente = true;
      requestAnimationFrame(function(){
        frascos.forEach(function(f){
          var p = parseFloat(f.getAttribute('data-prof')) || 12;
          f.style.setProperty('--mx', (px * p).toFixed(1) + 'px');
          f.style.setProperty('--my', (py * p * 0.5).toFixed(1) + 'px');
        });
        pendente = false;
      });
    }, { passive:true });
  }

  /* ---------------- slots de escolha (1 ou 2 frascos) ---------------- */
  var elSlots   = document.getElementById('bm-slots');
  var elUpsell  = document.getElementById('bm-upsell');
  var elLista   = document.getElementById('bm-resumo-lista');
  var elLinhas  = document.getElementById('bm-resumo-linhas');
  var elTitulo  = document.getElementById('bm-resumo-titulo');
  var elTotal   = document.getElementById('bm-resumo-total');
  var elAviso   = document.getElementById('bm-aviso');
  var elFinal   = document.getElementById('bm-finalizar');
  var elSticky  = document.getElementById('bm-sticky');
  var botoesOpc = document.querySelectorAll('.bm-opcao[data-opcao]');
  var cardsPreco= document.querySelectorAll('.bm-preco[data-opcao]');

  var CHECK = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 10.5l4 4 8-9"/></svg>';

  function montarSlots(){
    elSlots.innerHTML = '';
    if(estado.opcao === 'kit'){
      var aviso = document.createElement('p');
      aviso.className = 'bm-escolha-desc';
      aviso.style.margin = '0';
      aviso.textContent = 'O kit já vem com as três fragrâncias: Enigma, Midtown e Barbarius, 200 ml cada.';
      elSlots.appendChild(aviso);
      return;
    }
    var total = quantidade();
    for(var i=0;i<total;i++){ elSlots.appendChild(montarSlot(i,total)); }
  }

  function montarSlot(indice,total){
    var bloco = document.createElement('div');

    var titulo = document.createElement('p');
    titulo.className = 'bm-slot-titulo';
    titulo.textContent = total > 1 ? ('Fragrância ' + (indice+1)) : 'Escolha a fragrância';
    bloco.appendChild(titulo);

    var lista = document.createElement('div');
    lista.className = 'bm-escolhas';

    ORDEM.forEach(function(chave){
      var f = FRAGRANCIAS[chave];
      var linha = document.createElement('div');

      var botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'bm-escolha';
      botao.setAttribute('data-ac', f.ac);
      botao.setAttribute('aria-pressed', estado.escolhas[indice] === chave ? 'true' : 'false');
      botao.innerHTML =
        '<span class="bm-dot" aria-hidden="true"></span>' +
        '<span>' +
          '<span class="bm-escolha-nome">' + f.nome + '</span>' +
          '<span class="bm-escolha-desc">' + f.curta + '</span>' +
          '<span class="bm-escolha-vol">' + f.volume + '</span>' +
        '</span>';
      botao.addEventListener('click', function(){
        estado.escolhas[indice] = chave;
        atualizar();
      });

      var detalheId = 'bm-det-' + chave + '-' + indice;

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'bm-detalhe-btn';
      toggle.style.color = 'var(--bm-' + f.ac + ')';
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-controls', detalheId);
      toggle.textContent = 'Ver detalhes da fragrância';

      var detalhe = document.createElement('div');
      detalhe.className = 'bm-detalhe';
      detalhe.id = detalheId;
      detalhe.setAttribute('data-aberto','false');
      detalhe.innerHTML =
        '<div class="bm-detalhe-inner"><div class="bm-detalhe-corpo">' +
          '<strong>' + f.familia + '</strong> · ' + f.perfil + ' · ' + f.volume + ' / 6,76 oz' +
          '<p style="margin:8px 0 0;">' + f.completa + '</p>' +
        '</div></div>';

      toggle.addEventListener('click', function(){
        var aberto = detalhe.getAttribute('data-aberto') === 'true';
        detalhe.setAttribute('data-aberto', aberto ? 'false' : 'true');
        toggle.setAttribute('aria-expanded', aberto ? 'false' : 'true');
        toggle.textContent = aberto ? 'Ver detalhes da fragrância' : 'Ocultar detalhes';
      });

      linha.appendChild(botao);
      linha.appendChild(toggle);
      linha.appendChild(detalhe);
      lista.appendChild(linha);
    });

    bloco.appendChild(lista);
    return bloco;
  }

  /* ---------------- resumo do pedido ---------------- */
  function linha(rotulo, valor, classe){
    return '<div class="' + (classe || '') + '"><span>' + rotulo + '</span><b>' + valor + '</b></div>';
  }

  function atualizarResumo(){
    var kit = estado.opcao === 'kit';
    var frascos = quantidade();
    var itens = kit ? ORDEM.slice() : estado.escolhas.slice(0, frascos);
    var pendentes = 0;

    elTitulo.textContent = kit ? 'Seu kit' : 'Resumo do pedido';

    elLista.innerHTML = '';
    itens.forEach(function(chave, i){
      var li = document.createElement('li');
      if(!chave){
        pendentes++;
        li.setAttribute('data-vazio','true');
        li.innerHTML = 'Fragrância ' + (i+1) + ' <span>a escolher</span>';
      }else{
        li.innerHTML = CHECK + '<span style="flex:1;color:var(--bm-txt);">Bodyman ' +
          FRAGRANCIAS[chave].nome + '</span> <span>200 ml</span>';
      }
      elLista.appendChild(li);
    });

    var html = '';
    html += linha('Quantidade', frascos + (frascos > 1 ? ' produtos' : ' produto'));
    html += linha('Volume total', (frascos * 200) + ' ml');
    if(frascos > 1){
      html += linha('Valor se comprados separadamente', brl(precoAvulso(estado.opcao)));
      html += linha('Desconto da oferta', '−' + brl(economia(estado.opcao)), 'bm-eco');
    }
    html += linha('Frete', frascos >= CONFIG.FREE_SHIPPING_MIN_ITEMS ? 'Grátis' : 'Calculado no checkout');
    elLinhas.innerHTML = html;

    elTotal.textContent = brl(precoDe(estado.opcao));
    elFinal.innerHTML = 'Finalizar compra — ' + brl(precoDe(estado.opcao));

    if(pendentes > 0){
      elFinal.disabled = true;
      elAviso.textContent = pendentes === 1
        ? 'Escolha mais 1 fragrância para continuar.'
        : 'Escolha ' + pendentes + ' fragrâncias para continuar.';
    }else{
      elFinal.disabled = false;
      elAviso.textContent = '';
    }
  }

  function atualizar(){
    botoesOpc.forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-opcao') === estado.opcao ? 'true' : 'false');
    });
    cardsPreco.forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-opcao') === estado.opcao ? 'true' : 'false');
    });
    elUpsell.hidden = estado.opcao !== '2';
    montarSlots();
    atualizarResumo();
  }

  function irPara(alvo){
    var el = document.getElementById(alvo);
    if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  /* ---------------- eventos ---------------- */
  function selecionar(op, destino){
    estado.opcao = op;
    atualizar();
    if(destino) irPara(destino);
  }

  botoesOpc.forEach(function(b){
    b.addEventListener('click', function(){ selecionar(b.getAttribute('data-opcao')); });
  });

  cardsPreco.forEach(function(b){
    b.addEventListener('click', function(){ selecionar(b.getAttribute('data-opcao'), 'bm-seletor'); });
  });

  /* qualquer CTA do kit: card do kit, seção "por que", âncora de upsell,
     barra fixa do mobile e o botão "Quero os 3" do comparador */
  document.querySelectorAll('[data-kit-cta], #bm-quero-3').forEach(function(b){
    b.addEventListener('click', function(){ selecionar('kit', 'bm-resumo'); });
  });

  document.querySelectorAll('[data-escolher]').forEach(function(b){
    b.addEventListener('click', function(){
      var chave = b.getAttribute('data-escolher');
      if(estado.opcao === 'kit'){
        estado.opcao = '1';
        estado.escolhas = [chave, null];
      }else{
        var vaga = estado.escolhas.slice(0, quantidade()).indexOf(null);
        if(vaga === -1) vaga = 0;
        estado.escolhas[vaga] = chave;
      }
      atualizar();
      irPara('bm-seletor');
    });
  });

  elFinal.addEventListener('click', function(){
    var itens = estado.opcao === 'kit' ? ORDEM.slice() : estado.escolhas.slice(0, quantidade());
    var pedido = {
      opcao: estado.opcao,
      itens: itens.map(function(c){ return FRAGRANCIAS[c].nome; }),
      frascos: quantidade(),
      volume_ml: quantidade() * 200,
      total: precoDe(estado.opcao)
    };
    if(CONFIG.CHECKOUT_URL){
      window.location.href = CONFIG.CHECKOUT_URL;   /* conecte o checkout aqui */
      return;
    }
    console.log('Pedido:', pedido);
    elAviso.textContent = 'Pedido montado: ' + pedido.itens.join(', ') + ' — ' + brl(pedido.total) + '.';
  });

  /* ---------------- CTA fixo do mobile ---------------- */
  var resumoEl = document.getElementById('bm-resumo');
  function checarSticky(){
    var r = resumoEl.getBoundingClientRect();
    var resumoVisivel = r.top < window.innerHeight && r.bottom > 0;
    elSticky.setAttribute('data-visivel',
      (window.pageYOffset > 500 && !resumoVisivel) ? 'true' : 'false');
  }
  window.addEventListener('scroll', checarSticky, { passive:true });
  window.addEventListener('resize', checarSticky);

  /* ---------------- entrada dos elementos ao rolar ---------------- */
  function prepararEntrada(){
    var grupos = [
      document.querySelectorAll('.bm-figure'),
      document.querySelectorAll('.bm-slab-txt'),
      document.querySelectorAll('.bm-preco'),
      document.querySelectorAll('.bm-stat'),
      document.querySelectorAll('.bm-porque-card'),
      document.querySelectorAll('.bm-trio-frascos')
    ];
    var alvos = [];
    grupos.forEach(function(g){
      Array.prototype.forEach.call(g, function(el, i){
        el.classList.add('bm-reveal');
        el.style.setProperty('--atraso-entrada', (i * 0.09) + 's');
        alvos.push(el);
      });
    });

    if(!('IntersectionObserver' in window) ||
       window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      alvos.forEach(function(el){ el.classList.add('bm-visivel'); });
      return;
    }

    var obs = new IntersectionObserver(function(entradas){
      entradas.forEach(function(e){
        if(e.isIntersecting){
          e.target.classList.add('bm-visivel');
          obs.unobserve(e.target);
        }
      });
    }, { rootMargin:'0px 0px -12% 0px', threshold:0.12 });

    alvos.forEach(function(el){ obs.observe(el); });
  }

  /* ---------------- início ---------------- */
  preencherValores();
  preencherLancamento();
  preencherProvaSocial();
  aplicarEnvio();
  setInterval(aplicarEnvio, 60000);   /* mantém a mensagem e o tempo restante corretos */
  renderAvaliacoes();
  atualizar();
  checarSticky();
  prepararEntrada();
  ligarParallax();
})();
