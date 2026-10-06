# Bodyman — Página de vendas

Página de vendas dos Body Splash Bodyman (Primacial): Enigma, Midtown e Barbarius, 200 ml cada.
Domínio: idealstore.online (Vercel).

HTML, CSS e JavaScript puros. Sem build e sem dependências.

## Estrutura

```
index.html                  página de vendas
style.css                   todo o visual (mobile first)
site.js                     DADOS DA LOJA + recursos de todas as páginas (menu, WhatsApp, eventos do funil)
script.js                   PREÇOS, AVALIAÇÕES, seletor da oferta, botões de compra
checkout.js                 checkout PIX (dados → entrega → pagamento → confirmação)

politica-de-envio.html      políticas (textos básicos; trechos que dependem
trocas-e-devolucoes.html    da empresa ficam marcados com CONFIRMAR/PREENCHER)
politica-de-privacidade.html
termos-de-uso.html
rastrear-pedido.html

img/                        foto do kit, fotos de clientes, imagem de compartilhamento, ícones
fonts/                      fonte Archivo hospedada no próprio site (+ licença OFL)
enigma.webp, midtown.webp, barbarius.webp   fotos dos frascos (fundo transparente)

api/                        funções da Vercel (checkout PIX) — ver abaixo
scripts/servidor-local.js   servidor para testar no computador (não vai para o site)
```

## Onde alterar o quê

| O que | Onde |
|---|---|
| WhatsApp, e-mail, horário de atendimento | `site.js` → `SITE` |
| Razão social, CNPJ, endereço (rodapé e políticas) | `site.js` → `SITE` (`COMPANY_NAME`, `CNPJ`, `ADDRESS`) |
| Horário de corte da postagem, feriados, prazo de entrega | `site.js` → `SAME_DAY_SHIPPING_*`, `DELIVERY_ESTIMATE` |
| Link de rastreio da transportadora | `site.js` → `TRACKING_URL` (use `{codigo}` no lugar do código) |
| Google Analytics 4 | `site.js` → `GA4_ID` |
| Preços exibidos | `script.js` → `CONFIG` **e** os valores escritos no `index.html` |
| Preços cobrados | `api/_config.js` → `PLANS` (em centavos) |
| Avaliações | `script.js` → `REVIEWS` |
| Fotos da seção "Veja o Bodyman de perto" e da embalagem | `index.html` (instruções no próprio código) |

Campo vazio no `site.js` = a informação não aparece no site. Nada de exemplo
ou "a preencher" é mostrado para o cliente.

**Ao mudar um preço**, altere nos três lugares: `CONFIG` no `script.js`, os
valores escritos no `index.html` (busque o valor antigo, ex.: `R$ 97,00`) e
`PLANS` em `api/_config.js`. Os valores ficam no HTML para que a página nunca
apareça com preço vazio enquanto o JavaScript carrega.

### Ver o que falta preencher

Abra o site com `?preview=1` no fim do endereço (ex.: `idealstore.online/?preview=1`).
Aparecem os espaços reservados para fotos e as caixas amarelas com os dados que
faltam. Sem `?preview=1`, nada disso aparece.

## Avaliações

Ficam no array `REVIEWS` do `script.js`. Só use avaliações reais.

```js
{ name:'Lucas A.', rating:5, text:'Comentário do cliente', date:'2026-09-20',
  product:'Kit completo',
  photos:[{ src:'img/clientes/foto.webp', thumb:'img/clientes/foto-p.webp' }],
  avatar:'',            // foto do cliente (opcional)
  verified:true, orderRef:'IDEAL-20260920-AB12CD34',   // ou verifiedBy:'loja'
  featured:true }       // aparece nos destaques perto do botão de compra (até 3)
```

- Sem `name`, aparece "Cliente Bodyman". Sem `rating`, não aparecem estrelas.
- O selo "Compra verificada" só aparece com `verified:true` **e** `orderRef` (número do
  pedido) ou `verifiedBy` (quem confirmou a compra, ex.: `'loja'`) preenchido. Use só
  quando você sabe que a pessoa comprou.
- A nota média e as barras são calculadas das avaliações com nota. Sem nenhuma
  nota, a página não mostra estrelas.
- Fotos novas: converta para WebP (ex.: em squoosh.app), largura até 828 px, e
  coloque em `img/clientes/`. O `thumb` (420 px) é opcional.

## Funil de eventos

Cada evento vai para o Meta Pixel, para o `dataLayer` (Google Tag Manager) e
para o GA4 (se `GA4_ID` estiver preenchido). Todos levam dispositivo
(mobile/tablet/desktop), navegador interno (Instagram/Facebook/TikTok), origem,
meio, campanha, UTM e oferta.

| Evento | Quando | Meta Pixel |
|---|---|---|
| `page_view` | página aberta | `PageView` (código original do Pixel) |
| `view_product` | página de vendas aberta | `ViewContent` |
| `click_buy` | clique em qualquer botão de compra (`cta` diz qual) | `ClickBuy` (personalizado) |
| `select_offer` | oferta escolhida (kit, 2 ou 1 frasco) | `AddToCart` |
| `begin_checkout` | checkout aberto | `InitiateCheckout` |
| `add_customer_info` | dados pessoais preenchidos | — |
| `add_shipping_info` | endereço preenchido | `AddShippingInfo` (personalizado) |
| `pix_generated` | PIX criado com sucesso | `AddPaymentInfo` |
| `pix_copied` | código PIX copiado | `PixCopied` (personalizado) |
| `purchase` | **somente** com pagamento confirmado pelo servidor | `Purchase` (eventID = nº do pedido) |
| `whatsapp_click` | clique em qualquer link de WhatsApp | `Contact` |
| `pix_error` | falha ao gerar o PIX | — |

Eventos de etapa (`view_product`, `select_offer`, `begin_checkout`) são enviados
uma vez por página; `pix_generated` e `purchase`, uma vez por pedido, mesmo se a
página recarregar. Para ver os eventos no console: `?debug_funil=1`.

## Recuperação de PIX pendente

Cada PIX gerado fica gravado com cliente, telefone, pedido, valor, status,
horário, dispositivo, origem e campanha. Para listar:

1. Na Vercel, crie a variável `ADMIN_TOKEN` com uma senha longa (24+ caracteres).
2. Abra `https://idealstore.online/api/orders?token=SUA_SENHA`
   - `&status=PENDING_PAYMENT` só os não pagos
   - `&dias=7` período (até 60)
   - `&formato=csv` baixa planilha (abre no Excel/Google Planilhas)

A rota só lê dados: nenhuma mensagem é enviada a clientes. Sem `ADMIN_TOKEN`,
ela fica desligada (responde 404). Não compartilhe o link com a senha.

No navegador do cliente, o PIX gerado fica salvo até ser pago ou expirar: se a
pessoa sair para o app do banco e a página recarregar, aparece o aviso
"aguardando pagamento" com o mesmo código, e a confirmação continua automática.

---

# Checkout PIX (BlackCat)

## Arquivos

```
api/create-payment.js      POST /api/create-payment    cria a venda e devolve o PIX
api/payment-status.js      GET  /api/payment-status     consulta o status (token obrigatório)
api/blackcat-webhook.js    POST /api/blackcat-webhook   recebe transaction.paid
api/orders.js              GET  /api/orders             lista pedidos (só com ADMIN_TOKEN)

Módulos internos (o prefixo _ faz a Vercel NÃO transformá-los em rota):
api/_config.js             planos, produtos, flags, divisão de centavos
api/_validate.js           validação de plano, cliente, endereço e contexto
api/_store.js              persistência dos pedidos (Vercel KV / Upstash) + índice
api/_blackcat.js           cliente HTTP da BlackCat
api/_http.js               resposta JSON e erros sem vazar detalhe interno
```

Nenhum arquivo de /api pode ser copiado para a raiz: na raiz ele vira asset
público e a Vercel deixa de criar a Function.

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
| `ADMIN_TOKEN` | não | Liga a listagem `/api/orders`. 24+ caracteres. |

Nunca usar prefixo `VITE_` ou `NEXT_PUBLIC_`: isso entregaria a chave ao navegador.

Sem o KV configurado, os pedidos ficam só na memória de cada execução: a
confirmação automática do PIX e a listagem de pedidos não funcionam.

## Preços

Definidos em `api/_config.js`, em centavos: `single 4990`, `double 7990`,
`triple 9700`. O navegador envia apenas `plan`. Qualquer `amount`, `price` ou
`total` vindo do cliente é ignorado. Frete: `SHIPPING_AMOUNT = 0` (grátis em
todas as opções).

## Estados do pedido

`PENDING_PAYMENT` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED`,
além de `CANCELLED`, `REFUNDED` e `EXPIRED`.
Pagamento confirmado marca apenas `PAID`. Postagem é outra etapa.

---

# Como testar no computador

Precisa só do Node 18 ou mais novo.

```
node scripts/servidor-local.js
```

Abra http://localhost:3000. O servidor local roda **sempre em modo de teste**:
nenhuma cobrança real é criada e o PIX mostrado é falso. Para simular o
pagamento de um PIX de teste, copie o `transactionId` (começa com `TESTE-`)
e abra:

```
http://localhost:3000/__teste/pagar?transactionId=TESTE-IDEAL-...
```

A tela do checkout confirma sozinha em poucos segundos.

Para testar contra a BlackCat de verdade, use `vercel dev` com as variáveis de
ambiente configuradas (cuidado: aí o PIX é real).

## Antes de publicar

- Preencher no `site.js`: `COMPANY_NAME`, `CNPJ`, `ADDRESS`, `EMAIL` (se existir),
  `SUPPORT_HOURS`, `DELIVERY_ESTIMATE`, `TRACKING_URL` e os feriados.
- Revisar os trechos marcados com `CONFIRMAR` nas páginas de políticas e no FAQ
  (busque por `CONFIRMAR` nos arquivos .html).
- Conferir se o KV está conectado na Vercel.

## Publicação (Vercel)

O site é publicado pela Vercel a partir da branch `main`. A Vercel só publica
sozinha os commits feitos por uma conta com acesso ao projeto (a conta
jacksongutooo do GitHub). Se um commit chegar com outro autor, a publicação
fica bloqueada e o site continua na versão anterior. Nesse caso, faça qualquer
commit pela sua conta (ou use "Redeploy" na Vercel) para publicar a versão
mais recente da `main`.
