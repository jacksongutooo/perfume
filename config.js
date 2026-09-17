/**
 * Configuração oficial do checkout — fonte única de verdade do servidor.
 * Nada aqui pode ser sobrescrito pelo navegador.
 */

// Valores em CENTAVOS. Nunca usar ponto flutuante para dinheiro.
const PLANS = {
  single: { amount: 4990, quantity: 1, label: '1 Body Splash' },
  double: { amount: 7990, quantity: 2, label: '2 Body Splash' },
  triple: { amount: 9700, quantity: 3, label: 'Kit Completo com 3' }
};

const PRODUCTS = {
  enigma:    { slug: 'enigma',    title: 'Bodyman Enigma 200 ml' },
  midtown:   { slug: 'midtown',   title: 'Bodyman Midtown 200 ml' },
  barbarius: { slug: 'barbarius', title: 'Bodyman Barbarius 200 ml' }
};

// O kit é sempre uma unidade de cada fragrância.
const TRIPLE_PRODUCTS = ['enigma', 'midtown', 'barbarius'];

const PIX_EXPIRES_IN_DAYS = Number(process.env.PIX_EXPIRES_IN_DAYS || 1);

// Frete desta oferta é grátis: nada é somado ao total.
const SHIPPING_AMOUNT = 0;

// PAYMENTS_ENABLED=false -> não chama a BlackCat, devolve um PIX falso de teste.
const PAYMENTS_ENABLED = String(process.env.PAYMENTS_ENABLED || 'true') !== 'false';

const IS_PRODUCTION = process.env.VERCEL_ENV === 'production';

const ORDER_PREFIX = process.env.ORDER_PREFIX || 'IDEAL';

/**
 * Divide um total em centavos entre N itens sem perder nem inventar centavos.
 * distribuirCentavos(9700, 3) -> [3234, 3233, 3233]
 */
function distribuirCentavos(total, partes) {
  const base = Math.floor(total / partes);
  const resto = total - base * partes;
  const valores = [];
  for (let i = 0; i < partes; i++) valores.push(base + (i < resto ? 1 : 0));
  return valores;
}

function formatarBRL(centavos) {
  return 'R$ ' + (centavos / 100).toFixed(2).replace('.', ',');
}

module.exports = {
  PLANS,
  PRODUCTS,
  TRIPLE_PRODUCTS,
  PIX_EXPIRES_IN_DAYS,
  SHIPPING_AMOUNT,
  PAYMENTS_ENABLED,
  IS_PRODUCTION,
  ORDER_PREFIX,
  distribuirCentavos,
  formatarBRL
};
