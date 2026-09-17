# Bodyman — Página de vendas

Página de vendas dos Body Splash Bodyman (Primacial): Enigma, Midtown e Barbarius, 200 ml cada.

HTML, CSS e JavaScript puros. Sem build, sem dependências, sem instalação.

## Estrutura

```
index.html        marcação da página
css/style.css     estilos, animações e responsividade
js/script.js      preços, seletor, avaliações, envio e interações
img/              fotos dos frascos em WebP com fundo transparente
```

## Como rodar

Abra o `index.html` no navegador. Para publicar (Netlify, Vercel, GitHub Pages
ou hospedagem comum), envie a pasta inteira mantendo essa estrutura de diretórios.

## Configuração

Tudo que muda com frequência está no objeto `CONFIG`, no início de `js/script.js`:

| Constante | O que faz |
|---|---|
| `SINGLE_PRICE`, `DOUBLE_PRICE`, `TRIPLE_PRICE` | Preços de 1, 2 e 3 frascos. Valor por unidade, economia e a diferença de R$ 17,10 são calculados a partir daqui. |
| `PREVIOUS_SALES`, `AVERAGE_RATING` | Números da prova social. |
| `LAUNCH_BAR_MESSAGE`, `STOCK_BADGE` | Textos da barra do topo e do selo. |
| `PROMOTIONAL_STOCK_MESSAGE` | Aviso extra de estoque. Vazio = não aparece. |
| `SAME_DAY_SHIPPING_ENABLED` | Liga/desliga a regra de postagem no mesmo dia. |
| `SAME_DAY_SHIPPING_CUTOFF` | Horário de corte (`'12:00'`). Reescreve todos os textos. |
| `SAME_DAY_SHIPPING_TIMEZONE` | Fuso da operação. |
| `SAME_DAY_SHIPPING_HOLIDAYS` | Feriados (`['2026-12-25']`). Sem isso, só sábado e domingo são desconsiderados. |
| `SAME_DAY_SHIPPING_COUNTDOWN` | Mostra quanto falta para o corte. |
| `FREE_SHIPPING_MIN_ITEMS` | A partir de quantos frascos o frete é grátis. |
| `CHECKOUT_URL` | Link do checkout. Vazio = o botão só registra o pedido no console. |

## Avaliações

Ficam no array `REAL_REVIEWS`, logo abaixo do `CONFIG`.

```js
{ name:'Nome Sobrenome', initials:'NS', age:30, rating:5,
  product:'Kit Completo', text:'...' }
```

Opcionais: `date: '2026-09-10'` faz o card exibir "há X dias" calculado
automaticamente, e `verified: true` exibe o selo "Compra verificada".

## Antes de publicar

- Preencher `CHECKOUT_URL`.
- Preencher `SAME_DAY_SHIPPING_HOLIDAYS` com os feriados do ano.
- Conferir se o frete grátis vale para todas as quantidades (`FREE_SHIPPING_MIN_ITEMS`).

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

Nenhum arquivo de /api pode ser copiado para a raiz: na raiz ele vira asset
público e a Vercel deixa de criar a Function.
checkout.js                fluxo de checkout no navegador
```

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

Definidos em `api/_lib/config.js`, em centavos: `single 4990`, `double 7990`,
`triple 9700`. O navegador envia apenas `plan`. Qualquer `amount`, `price` ou
`total` vindo do cliente é ignorado.

Ao mudar o preço, alterar nos dois lugares: `CONFIG` em `script.js` (o que o
cliente vê) e `PLANS` em `api/_lib/config.js` (o que é cobrado).

## Estados do pedido

`PENDING_PAYMENT` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED`,
além de `CANCELLED`, `REFUNDED` e `EXPIRED`.
Pagamento confirmado marca apenas `PAID`. Postagem é outra etapa.
