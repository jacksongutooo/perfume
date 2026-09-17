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
