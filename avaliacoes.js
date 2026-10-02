/* =====================================================================
   AVALIAÇÕES DE CLIENTES — edite somente este arquivo.

   Campos de cada avaliação (todos opcionais, exceto ter texto OU foto):
     nome        'Lucas A.'                 vazio = aparece "Cliente"
     nota        5                          1 a 5. null = sem estrelas
     texto       'Comentário do cliente'
     data        '2026-09-20'               AAAA-MM-DD. vazio = sem data
     produto     'Kit completo'
     idade       30
     fotos       [{ src:'img/clientes/foto.webp', mini:'img/clientes/foto-mini.webp', w:828, h:1323 }]
                 fotos do produto enviadas pelo cliente (w e h = tamanho da foto)
     fotoCliente 'img/clientes/rosto.webp'  foto do cliente para o avatar
     verificada  true                       SÓ quando der para ligar a avaliação a um pedido real
     destaque    true                       aparece logo abaixo do botão de compra (máximo 3)

   Regra: só publique avaliações reais. Nada aqui é gerado automaticamente,
   e a página não inventa nome, nota, texto ou data que não estejam aqui.
   ===================================================================== */
window.BM_AVALIACOES = [

  /* ---------------------------------------------------------------
     Fotos reais enviadas por clientes.
     PREENCHER quando tiver: nome, nota, texto e data de cada cliente.
     Enquanto estiverem vazios, o card mostra só a foto com a legenda
     "Foto enviada por cliente", sem estrelas e sem texto.
     --------------------------------------------------------------- */
  { nome: '', nota: null, texto: '', data: '', produto: 'Kit completo', destaque: true,
    fotos: [{ src: 'img/clientes/cliente-2.webp', mini: 'img/clientes/cliente-2-mini.webp', w: 828, h: 1323 }] },

  { nome: '', nota: null, texto: '', data: '', produto: 'Kit completo', destaque: true,
    fotos: [{ src: 'img/clientes/cliente-3.webp', mini: 'img/clientes/cliente-3-mini.webp', w: 626, h: 1121 }] },

  { nome: '', nota: null, texto: '', data: '', produto: 'Kit completo', destaque: true,
    fotos: [{ src: 'img/clientes/cliente-5.webp', mini: 'img/clientes/cliente-5-mini.webp', w: 828, h: 1340 }] },

  { nome: '', nota: null, texto: '', data: '', produto: 'Kit completo',
    fotos: [{ src: 'img/clientes/cliente-1.webp', mini: 'img/clientes/cliente-1-mini.webp', w: 828, h: 1182 }] },

  { nome: '', nota: null, texto: '', data: '', produto: 'Kit completo',
    fotos: [{ src: 'img/clientes/cliente-4.webp', mini: 'img/clientes/cliente-4-mini.webp', w: 828, h: 1323 }] },

  /* ---------------------------------------------------------------
     Avaliações em texto que já estavam no site (mantidas como estavam).
     CONFIRMAR: se alguma não veio de um cliente real, apague-a.
     --------------------------------------------------------------- */
  { nome: 'Lucas Andrade', idade: 23, nota: 5, produto: 'Kit completo',
    texto: 'Peguei o kit com os três e valeu demais. O Enigma virou meu favorito, mas os três são bem diferentes entre si. Na minha pele senti o cheiro por umas 5 horas tranquilo. Pelo preço do trio, achei muito bom.' },
  { nome: 'Rafael Mendes', idade: 31, nota: 5, produto: 'Kit completo',
    texto: 'Chegou rápido e muito bem embalado. Gostei bastante da proposta de ter três fragrâncias pra momentos diferentes. Barbarius é mais forte, Midtown é mais suave e Enigma fica no meio. Kit completo vale muito mais a pena.' },
  { nome: 'Bruno Carvalho', idade: 27, nota: 5, produto: 'Kit completo',
    texto: 'Pelo preço eu tava esperando algo mais simples, mas me surpreendeu. Frasco grande de 200 ml e cheiro bem agradável. Em mim a fixação ficou perto de 4 a 5 horas. Compraria novamente.' },
  { nome: 'Gustavo Lima', idade: 38, nota: 5, produto: 'Kit completo',
    texto: 'Comprei o trio e não me arrependo. Uso um no trabalho, outro pra sair e outro no dia a dia. A variedade é o melhor do kit. Veio tudo certinho e bem protegido.' },
  { nome: 'Mateus Rocha', idade: 21, nota: 4, produto: 'Midtown',
    texto: 'Curti bastante. Meu favorito foi o Midtown porque é mais limpo e fácil de usar todo dia. A duração na minha pele ficou em torno de 4 horas. Pelo valor, achei justo demais.' },
  { nome: 'Diego Martins', idade: 34, nota: 5, produto: 'Kit completo',
    texto: 'Barbarius é absurdo de bom pra noite. Tem uma pegada mais marcante e diferente. O kit com três compensa porque você não fica preso em uma fragrância só. Chegou bem rápido aqui.' },
  { nome: 'Felipe Souza', idade: 29, nota: 5, produto: 'Enigma',
    texto: 'Já tinha usado body splash antes, mas esses me surpreenderam. O Enigma ficou umas 5 horas na minha pele e ainda dava pra sentir de perto depois. Gostei bastante da embalagem também.' },
  { nome: 'André Ribeiro', idade: 42, nota: 5, produto: 'Kit completo',
    texto: 'Gostei da apresentação e principalmente do custo-benefício. São três frascos grandes e cada um tem uma proposta diferente. Pra quem gosta de variar perfume, faz bastante sentido.' },
  { nome: 'Caio Fernandes', idade: 19, nota: 5, produto: 'Kit completo',
    texto: 'Kit muito bom pelo preço. Eu e meu irmão já estamos disputando o Barbarius kkk. Cheiro forte na medida e na minha pele durou perto de 6 horas.' },
  { nome: 'Eduardo Nunes', idade: 45, nota: 5, produto: 'Kit completo',
    texto: 'Produto chegou bem embalado, sem vazamento e dentro do esperado. Gostei mais do Enigma, tem um cheiro elegante e fácil de usar. O trio foi uma boa compra.' },
  { nome: 'Henrique Alves', idade: 26, nota: 5, produto: 'Kit completo',
    texto: 'Eu ia pegar só dois, mas pela diferença de preço preferi levar os três. Ainda bem que fiz isso, porque o Midtown que eu achava que seria o que menos usaria acabou sendo um dos melhores.' },
  { nome: 'Marcelo Costa', idade: 52, nota: 4, produto: 'Kit completo',
    texto: 'Boa variedade de fragrâncias e frascos com ótimo tamanho. Não são todos iguais, cada um tem um estilo bem próprio. Em mim a duração ficou em torno de 4 horas, o que achei bom para body splash.' },
  { nome: 'João Pedro Santos', idade: 24, nota: 5, produto: 'Kit completo',
    texto: 'O kit completo é disparado a melhor opção. Três body splash de 200 ml por esse valor compensa demais. Chegou rápido e tudo bem protegido.' },
  { nome: 'Thiago Moreira', idade: 36, nota: 5, produto: 'Kit completo',
    texto: 'O Barbarius foi o que mais gostei. Mais intenso e com presença. O Enigma também é muito bom pra usar à noite. No meu caso ficaram umas 5 horas perceptíveis.' },
  { nome: 'Leonardo Freitas', idade: 28, nota: 5, produto: 'Kit completo',
    texto: 'Gostei porque não parece que você comprou três cheiros iguais com rótulos diferentes. Cada um tem uma identidade. Pelo preço do combo, achei excelente.' },
  { nome: 'Rodrigo Teixeira', idade: 41, nota: 5, produto: 'Midtown',
    texto: 'Recebi antes do que esperava e veio tudo muito bem embalado. O Midtown é ótimo pra usar no trabalho porque é mais discreto e sofisticado. Vou comprar o kit novamente quando acabar.' },
  { nome: 'Vinícius Barros', idade: 22, nota: 5, produto: 'Enigma',
    texto: 'Pra mim o Enigma ganhou fácil. Cheiro muito bom e fixa legal. Passei de manhã e umas 4 a 5 horas depois ainda sentia na pele. O trio compensa demais.' },
  { nome: 'Alexandre Moraes', idade: 48, nota: 4, produto: 'Kit completo',
    texto: 'Bom custo-benefício. Os frascos são grandes e o kit permite variar bastante. Gostei especialmente do Midtown. Entrega rápida e embalagem bem feita.' },
  { nome: 'Murilo Cardoso', idade: 33, nota: 5, produto: 'Kit completo',
    texto: 'Comprei pela promoção do trio e achei que valeu cada real. O Barbarius é mais intenso, Enigma mais elegante e Midtown mais versátil. Uso os três dependendo da ocasião.' },
  { nome: 'Daniel Pires', idade: 57, nota: 5, produto: 'Kit completo',
    texto: 'Gostei bastante da qualidade geral. Boa apresentação, fragrâncias agradáveis e quantidade excelente. Na minha pele a duração ficou perto de 5 horas. Pelo valor do kit completo, achei uma ótima compra.' }
];
