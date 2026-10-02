# Bodyman — Página de vendas (idealstore.online)

Página de vendas dos Body Splash Bodyman (Primacial): Enigma, Midtown e Barbarius, 200 ml cada.
Oferta principal: kit com as 3 fragrâncias (600 ml).

HTML, CSS e JavaScript puros, sem build. O checkout PIX roda em funções da Vercel (pasta `api/`).

## Estrutura

```
index.html                 página de vendas
rastreio.html              rastrear pedido (WhatsApp e, se configurado, link da transportadora)
politica-de-envio.html     política de envio
trocas-e-devolucoes.html   política de troca e devolução
privacidade.html           política de privacidade (LGPD)
termos.html                termos de uso

style.css                  todo o visual (mobile primeiro)
site.js                    contato, dados da empresa, menu, WhatsApp e eventos do funil (todas as páginas)
avaliacoes.js              avaliações de clientes (só dados)
script.js                  preços, seletor de oferta, envio, avaliações, fotos e botões de compra
checkout.js                checkout PIX (dados -> entrega -> pagamento)

enigma.webp, midtown.webp, barbarius.webp   fotos dos frascos
img/clientes/              fotos enviadas por clientes (tamanho grande + miniatura "-mini")
img/og-bodyman.jpg         imagem que aparece ao compartilhar o link
img/favicon.svg            ícone da aba

dev/servidor-local.js      servidor para testar no computador (não é publicado)
```

## O que editar e onde

| O quê | Arquivo | Campo |
|---|---|---|
| Preços exibidos | `script.js` | `SINGLE_PRICE`, `DOUBLE_PRICE`, `TRIPLE_PRICE` |
| Preços cobrados | `api/_config.js` | `PLANS` (em centavos) |
| Horário de corte do envio | `script.js` | `SAME_DAY_SHIPPING_CUTOFF` (e o texto de `politica-de-envio.html`) |
| Feriados | `script.js` | `SAME_DAY_SHIPPING_HOLIDAYS` |
| Barra do topo e selo da foto | `script.js` | `TOP_BAR_MESSAGE`, `OFFER_BADGE` |
| Nota média | `script.js` | `AVERAGE_RATING` (`null` = calcula pelas notas de `avaliacoes.js`) |
| Vendas anteriores | `script.js` | `PREVIOUS_SALES` + `SHOW_PREVIOUS_SALES: true` (só se o número for real) |
| Fotos "Veja o Bodyman de perto" | `script.js` | `FOTOS_DE_PERTO` |
| Foto da embalagem | `script.js` | `FOTO_EMBALAGEM` |
| Avaliações | `avaliacoes.js` | lista `BM_AVALIACOES` |
| WhatsApp, horário, e-mail | `site.js` | `WHATSAPP_*`, `ATENDIMENTO_HORARIO`, `EMAIL` |
| Razão social, CNPJ, endereço | `site.js` | `EMPRESA` |
| Link de rastreio da transportadora | `site.js` | `RASTREIO_TRANSPORTADORA`, `RASTREIO_URL` |

Os preços também estão escritos no `index.html` como reserva (para nunca aparecer
campo vazio se o JavaScript demorar ou falhar). O `script.js` reescreve tudo a partir
do `CONFIG`. Ao mudar um preço, atualize: `script.js`, `api/_config.js`, os textos com
`data-preco`/`data-atual` no `index.html` e o `"price"` do bloco `application/ld+json` no `<head>`.

### Campos vazios e pré-visualização

Campos não preenchidos (CNPJ, e-mail, horário, fotos...) **não aparecem** no site publicado.
Para ver o que falta, abra a página em modo de pré-visualização: `localhost`, um endereço
`*.vercel.app` ou qualquer URL com `?preview=1` (ex.: `https://idealstore.online/?preview=1`).
Nesse modo, os campos pendentes aparecem destacados em amarelo e os espaços de foto
aparecem como quadros tracejados.

### Avaliações

Ficam em `avaliacoes.js`. Campos: `nome`, `nota` (1 a 5), `texto`, `data` (`'2026-09-20'`),
`produto`, `fotos`, `fotoCliente`, `verificada` e `destaque` (as 3 primeiras com
`destaque: true` aparecem logo abaixo do botão de compra).

Só publique avaliações reais. Use `verificada: true` apenas quando der para ligar a
avaliação a um pedido de verdade. Fotos de clientes ficam em `img/clientes/`
(versão grande + miniatura com `-mini` no nome).

Para gerar a miniatura de uma foto nova (com ImageMagick):

```
convert foto.jpg -auto-orient -strip -resize '828x1400>' -quality 78 img/clientes/cliente-6.webp
convert foto.jpg -auto-orient -strip -resize '360x>' -quality 72 img/clientes/cliente-6-mini.webp
```

## Eventos do funil

Todos os eventos vão para `window.dataLayer` (GTM/GA4), para o Meta Pixel e para o `gtag`,
se um dia for instalado. Cada evento leva o contexto da visita: `device_type`
(mobile/tablet/desktop), `browser_app` (instagram, facebook, tiktok...), `os`,
`traffic_source`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
e `offer` (oferta selecionada).

| Evento | Quando | Meta Pixel |
|---|---|---|
| `page_view` | abriu a página (1x) | (o PageView já sai no `<head>`) |
| `view_product` | viu a oferta (1x por página) | `ViewContent` |
| `select_offer` | trocou entre kit / 2 / 1 frasco | `SelectOffer` (personalizado) |
| `click_buy` | clicou em qualquer botão de compra (`cta` diz qual) | `ClickBuy` (personalizado) |
| `begin_checkout` | abriu o checkout (1x por oferta) | `InitiateCheckout` |
| `add_contact_info` | preencheu os dados | — |
| `add_shipping_info` | preencheu o endereço | `AddShippingInfo` (personalizado) |
| `pix_generated` | o PIX foi gerado de verdade | `AddPaymentInfo` |
| `purchase` | pagamento confirmado pelo servidor (1x por pedido) | `Purchase` |
| auxiliares | `checkout_step`, `checkout_close`, `pix_requested`, `pix_error`, `pix_copied`, `pix_expired`, `whatsapp_click` | `whatsapp_click` = `Contact` |

Para ver os eventos no navegador: abra o site com `?debug_funil=1` e veja o console.

## PIX pendente

Depois que o PIX é gerado, o código fica guardado no próprio navegador do cliente
(sem dados pessoais). Se ele fechar a janela ou a página recarregar enquanto está no
app do banco, aparece o aviso "Você tem um PIX pendente" com o botão para voltar ao
código, e a confirmação continua automática.

## Como testar no computador

Precisa do Node 18 ou mais novo. Na pasta do projeto:

```
node dev/servidor-local.js
```

Abra http://localhost:3000. A API do PIX é **simulada** (nenhuma cobrança real):
o código PIX é falso e o pagamento é aprovado sozinho depois de 25 segundos.
Para aprovar na hora, abra http://localhost:3000/__pagar em outra aba.

Para testar com as funções verdadeiras da pasta `api/` (precisa das variáveis de
ambiente do KV), use sempre o modo de teste:

```
PAYMENTS_ENABLED=false KV_REST_API_URL=... KV_REST_API_TOKEN=... node dev/servidor-local.js --real
```

---

# Checkout PIX (BlackCat)

## Arquivos

```
api/create-payment.js      POST /api/create-payment    cria a venda e devolve o PIX
api/payment-status.js      GET  /api/payment-status     consulta o status (token obrigatório)
api/blackcat-webhook.js    POST /api/blackcat-webhook   recebe transaction.paid

Módulos internos (o prefixo _ faz a Vercel NÃO transformá-los em rota):
api/_config.js             planos, produtos, flags, divisão de centavos
api/_validate.js           validação de plano, cliente e endereço
api/_store.js              persistência dos pedidos (Vercel KV / Upstash)
api/_blackcat.js           cliente HTTP da BlackCat
api/_http.js               resposta JSON e erros sem vazar detalhe interno
```

Nenhum arquivo de `/api` deve ser copiado para a raiz: na raiz ele vira arquivo público.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `BLACKCAT_API_KEY` | sim | Autentica na BlackCat. Só no servidor. |
| `KV_REST_API_URL` | sim | Banco dos pedidos. Criada sozinha ao conectar um KV/Upstash. |
| `KV_REST_API_TOKEN` | sim | Idem. |
| `PAYMENTS_ENABLED` | não | `false` = modo de teste, não cria cobrança real. Padrão `true`. |
| `BLACKCAT_WEBHOOK_URL` | não | Padrão `https://idealstore.online/api/blackcat-webhook`. |
| `BLACKCAT_WEBHOOK_SECRET` | não | Se definido, o webhook exige `?secret=` ou `X-Webhook-Secret`. |
| `PIX_EXPIRES_IN_DAYS` | não | Padrão `1`. |

Nunca usar prefixo `VITE_` ou `NEXT_PUBLIC_`: isso entregaria a chave ao navegador.

## Preços

Definidos em `api/_config.js`, em centavos: `single 4990`, `double 7990`,
`triple 9700`. O navegador envia apenas `plan`. Qualquer `amount`, `price` ou
`total` vindo do cliente é ignorado. O frete é `SHIPPING_AMOUNT = 0` (grátis em todas as opções).

## Estados do pedido

`PENDING_PAYMENT` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED`,
além de `CANCELLED`, `REFUNDED` e `EXPIRED`.
Pagamento confirmado marca apenas `PAID`. Postagem é outra etapa.
