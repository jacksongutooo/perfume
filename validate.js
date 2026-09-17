/**
 * Toda validação acontece aqui, no servidor.
 * O que o navegador valida serve só para a experiência do cliente.
 */
const { PLANS, PRODUCTS, TRIPLE_PRODUCTS } = require('./config');

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const digitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const texto = (v) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ');

function emailValido(email) {
  const e = texto(email).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) && e.length <= 120 ? e : null;
}

function telefoneValido(tel) {
  const d = digitos(tel);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 11 && d[2] !== '9') return null;
  return d;
}

/** CPF: 11 dígitos + dígitos verificadores. */
function cpfValido(cpf) {
  const d = digitos(cpf);
  if (d.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(d)) return null;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    let dv = (soma * 10) % 11;
    if (dv === 10) dv = 0;
    if (dv !== Number(d[t])) return null;
  }
  return d;
}

function cepValido(cep) {
  const d = digitos(cep);
  return d.length === 8 ? d : null;
}

function nomeValido(nome) {
  const n = texto(nome);
  if (n.length < 5 || n.length > 80) return null;
  const partes = n.split(' ').filter((p) => p.length >= 2);
  return partes.length >= 2 ? n : null;
}

/** Valida o plano e devolve a lista definitiva de fragrâncias. */
function validarPlano(plan, selectedProducts) {
  if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) {
    return { erro: 'Opção de compra inválida.' };
  }

  // O kit é sempre 1x de cada. Ignora o que vier do navegador.
  if (plan === 'triple') return { plan, produtos: TRIPLE_PRODUCTS.slice() };

  const lista = Array.isArray(selectedProducts) ? selectedProducts : [];
  const limpos = lista
    .map((p) => String(p || '').toLowerCase().trim())
    .filter((p) => Object.prototype.hasOwnProperty.call(PRODUCTS, p));

  if (plan === 'single') {
    if (limpos.length !== 1) return { erro: 'Escolha 1 fragrância para continuar.' };
    return { plan, produtos: limpos };
  }

  // double: exatamente 2 fragrâncias diferentes
  if (limpos.length !== 2) return { erro: 'Escolha 2 fragrâncias para continuar.' };
  if (limpos[0] === limpos[1]) return { erro: 'Escolha 2 fragrâncias diferentes.' };
  return { plan, produtos: limpos };
}

function validarCliente(c) {
  const dados = c || {};
  const nome = nomeValido(dados.name);
  if (!nome) return { erro: 'Informe seu nome completo.' };

  const email = emailValido(dados.email);
  if (!email) return { erro: 'Informe um e-mail válido.' };

  const telefone = telefoneValido(dados.phone);
  if (!telefone) return { erro: 'Informe um telefone válido com DDD.' };

  const cpf = cpfValido(dados.cpf || dados.document);
  if (!cpf) return { erro: 'Informe um CPF válido.' };

  return { customer: { name: nome, email, phone: telefone, cpf } };
}

function validarEndereco(s) {
  const dados = s || {};
  const zipCode = cepValido(dados.zipCode);
  if (!zipCode) return { erro: 'Informe um CEP válido com 8 números.' };

  const street = texto(dados.street);
  if (street.length < 3 || street.length > 100) return { erro: 'Informe o endereço de entrega.' };

  const number = texto(dados.number).slice(0, 12);
  if (!number) return { erro: 'Informe o número do endereço.' };

  const neighborhood = texto(dados.neighborhood);
  if (neighborhood.length < 2 || neighborhood.length > 60) return { erro: 'Informe o bairro.' };

  const city = texto(dados.city);
  if (city.length < 2 || city.length > 60) return { erro: 'Informe a cidade.' };

  const state = texto(dados.state).toUpperCase();
  if (state.length !== 2 || UFS.indexOf(state) === -1) return { erro: 'Informe um estado válido (UF).' };

  const complement = texto(dados.complement).slice(0, 60); // pode ficar vazio

  return { shipping: { zipCode, street, number, complement, neighborhood, city, state } };
}

function limparUTM(utm) {
  const origem = utm || {};
  const campos = ['source', 'medium', 'campaign', 'content', 'term'];
  const saida = {};
  campos.forEach((c) => {
    const v = texto(origem[c]).slice(0, 120);
    if (v) saida[c] = v;
  });
  return saida;
}

module.exports = {
  validarPlano, validarCliente, validarEndereco, limparUTM,
  digitos, texto, cpfValido, emailValido, telefoneValido, cepValido, nomeValido, UFS
};
