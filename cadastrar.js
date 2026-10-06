import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Argumentos: node cadastrar.js <veiculo|imovel> "<texto>" [qtd_fotos] [categoria_opcional] [qtd_videos]
const tipo = process.argv[2];
const textoBruto = process.argv[3];
const arg4 = process.argv[4];
const arg5 = process.argv[5];
const arg6 = process.argv[6];

const qtdFotos = !isNaN(parseInt(arg4))
  ? parseInt(arg4)
  : !isNaN(parseInt(arg5))
    ? parseInt(arg5)
    : 1;

const categoriaInformada = isNaN(parseInt(arg4))
  ? arg4
  : isNaN(parseInt(arg5))
    ? arg5
    : null;

if (!tipo || !textoBruto) {
  console.log(
    '❌ Uso correto: node cadastrar.js <veiculo|imovel> "<texto>" [qtd_fotos] [categoria_opcional] [qtd_videos]',
  );
  process.exit(1);
}

const arquivoTarget = tipo === "veiculo" ? "veiculos.json" : "imoveis.json";
const caminhoArquivo = path.join(__dirname, arquivoTarget);

let dados = [];
try {
  const conteudo = fs.readFileSync(caminhoArquivo, "utf-8");
  dados = JSON.parse(conteudo);
} catch (err) {
  console.error(`Erro ao ler o arquivo ${arquivoTarget}:`, err);
  process.exit(1);
}

function limparTexto(texto) {
  let t = texto;

  // 1. Remove cabeçalhos/metadados do WhatsApp
  t = t.replace(/\[\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}\]\s*[^:]+:\s*/g, "");

  // 2. Corrige erros de digitação / termos comuns
  t = t
    .replace(/\bposso\s+artesiano\b/gi, "poço artesiano")
    .replace(/\bmetos\b/gi, "metros")
    .replace(/\bvalr\b/gi, "valor")
    .replace(/\bcondominio\b/gi, "condomínio")
    .replace(/\bchacara\b/gi, "chácara")
    .replace(/\bsitio\b/gi, "sítio");

  // 3. Corrige pontuação colada ou excessiva
  t = t
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\.\s*/g, ". ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/,\s*,+/g, ",")
    .replace(/\.\s*\.+/g, ".")
    .replace(/,\s*\./g, ".")
    .replace(/\s+/g, " ")
    .trim();

  // 4. Garante letra maiúscula no início
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }

  // 5. Garante ponto final
  if (t.length > 0 && !/[.!?]$/.test(t)) {
    t += ".";
  }

  return t;
}

function extrairKm(texto) {
  const matchKm =
    texto.match(/(?:km|kl)\s*:?\s*\.?\s*(\d+([\.,]\d+)?)/i) ||
    texto.match(/(\d{1,3}(\.\d{3})*|\d+)\s*(km|mil km)/i);

  if (matchKm) {
    let val = matchKm[1];
    return val.length <= 3 ? `${val}.000 KM` : `${val} KM`;
  }
  return "N/A";
}

function extrairPreco(texto) {
  let valorFormatado = "";

  // Procura padrão "620 MIL" ou "620mil" (com suporte a maiúsculas/minúsculas)
  const matchMil = texto.match(/(\d{1,3}(?:\.\d{3})?)\s*mil/i);
  if (matchMil) {
    let val = matchMil[1].replace(".", "");
    let numero = parseInt(val, 10) * 1000;
    return `R$ ${numero.toLocaleString("pt-BR")},00`;
  }

  // 2. Procura formato "20 mil" ou "20.000"
  if (!valorFormatado) {
    const matchMil = texto.match(/(\d{2,3}(?:\.\d{3})?)\s*mil/i);
    if (matchMil) {
      let val = matchMil[1].replace(".", "");
      valorFormatado = `${parseInt(val).toLocaleString("pt-BR")},00`;
    }
  }

  // 3. Procura valor com R$
  if (!valorFormatado) {
    const matchBrl = texto.match(/r\$\s*([\d\.]+,\d{2}|[\d\.]+)/i);
    if (matchBrl) {
      let p = matchBrl[1];
      valorFormatado = p.includes(",") ? p : `${p},00`;
    }
  }

  // Se encontrou algum valor, garante o prefixo "R$ "
  if (valorFormatado) {
    return valorFormatado.startsWith("R$")
      ? valorFormatado
      : `R$ ${valorFormatado}`;
  }

  return "Sob Consulta"; // Se não houver preço no texto
}

function extrairArea(texto) {
  // Trata '300m²' mesmo colado em parênteses ou pontuação
  const matchArea = texto.match(
    /(\d+(?:[\.,]\d+)?)\s*(m²|m2|metros\s*quadrados)/i,
  );
  return matchArea ? `${matchArea[1]} m²` : "";
}

function extrairLocalizacao(texto) {
  // Procura por cidades conhecidas ou termos entre hífens
  const matchCidade = texto.match(
    /-\s*([A-ZÁÀÂÃÉÈÊÍÓÔÕÚÇ][a-záàâãéèêíóôõúç]+)\s*-/,
  );
  if (matchCidade) return matchCidade[1].trim();

  // Se não encontrar, tenta capturar a última palavra que parece ser uma cidade
  const matchUltima = texto.match(
    /([A-ZÁÀÂÃÉÈÊÍÓÔÕÚÇ][a-záàâãéèêíóôõúç]+)\s*$/,
  );
  return matchUltima ? matchUltima[1].trim() : "";
}

function identificarCategoria(texto, tipo) {
  if (categoriaInformada) return categoriaInformada;

  const t = texto.toLowerCase();

  if (tipo === "imovel") {
    if (t.includes("terreno")) return "Terreno";
    if (t.includes("chácara") || t.includes("chacara")) return "Chácara";
    if (t.includes("sítio") || t.includes("sitio")) return "Sítio";
    if (t.includes("apartamento") || t.includes("apto")) return "Apartamento";
    if (t.includes("casa")) return "Casa";
    return "Imóvel";
  } else {
    if (
      t.includes("carreta") ||
      t.includes("cavalo") ||
      t.includes("conjunto") ||
      t.includes("bitrem")
    )
      return "Carreta";
    if (
      t.includes("caminhão") ||
      t.includes("caminhao") ||
      t.includes("scania") ||
      t.includes("volvo") ||
      t.includes("iveco")
    )
      return "Caminhão";
    if (
      t.includes("caminhonete") ||
      t.includes("hilux") ||
      t.includes("s10") ||
      t.includes("ranger")
    )
      return "Caminhonete";
    if (t.includes("moto") || t.includes("honda") || t.includes("yamaha"))
      return "Moto";
    return "Carro";
  }
}

function extrairTitulo(texto, categoria, tipo) {
  if (tipo === "veiculo") {
    // Lista de palavras genéricas no início do texto para ignorar
    const ignorar =
      /^(carro|veiculo|veículo|vendo|vende-se|otimo|ótimo|lindo|excelente|procedência|procedencia)\b/i;

    // Tenta capturar uma marca/modelo conhecida no texto (ex: Gol, Palio, Civc, Scania, etc)
    const marcasModelos =
      /(gol|palio|uno|celta|corsa|civic|corolla|fox|fiesta|ka|fit|hb20|s10|hilux|ranger|saveiro|strada|titan|fan|biz|scania|volvo|iveco|vw|chevrolet|fiat|ford|honda|toyota|hyundai|renault|peugeot)/i;
    const matchModelo = texto.match(marcasModelos);

    if (matchModelo) {
      // Pega o modelo encontrado + a palavra seguinte (ex: "Gol 1.6", "Scania 440")
      const regexSubsequente = new RegExp(
        `\\b${matchModelo[1]}\\b\\s*\\w*`,
        "i",
      );
      const encontrado = texto.match(regexSubsequente);
      if (encontrado) {
        return encontrado[0].replace(/[,.-]$/, "").trim();
      }
    }

    const palavras = texto.split(" ");
    const primeiras = palavras
      .slice(0, 3)
      .join(" ")
      .replace(/[,.-]$/, "");

    // Se o início for genérico, usa "Categoria à Venda"
    if (ignorar.test(primeiras)) {
      const catFormatada =
        categoria.charAt(0).toUpperCase() + categoria.slice(1);
      return `${catFormatada} à Venda`;
    }

    return primeiras || `${categoria} à Venda`;
  } else {
    const matchAssoc = texto.match(
      /(associação|associacao|condomínio|condominio)\s+([a-záàâãéèêíóôõúç0-9\s]+?)(?=\,|\.|$)/i,
    );
    if (matchAssoc)
      return `${categoria} no ${matchAssoc[0]}`.replace(/\s+/g, " ").trim();
    return `${categoria} à Venda`;
  }
}

// Processamento
const textoLimpo = limparTexto(textoBruto);
const preco = extrairPreco(textoLimpo);
const categoria = identificarCategoria(textoLimpo, tipo);
const titulo = extrairTitulo(textoLimpo, categoria, tipo);
const idGerado = `${tipo}-${Date.now().toString().slice(-4)}`;

// Fotos
const fotos = [];
const pasta = tipo === "veiculo" ? "veiculos" : "imoveis";
for (let i = 1; i <= qtdFotos; i++) {
  fotos.push(`assets/images/${pasta}/${idGerado}-${i}.webp`);
}

// Vídeos
const qtdVideos = arg6 ? parseInt(arg6.replace(/\D/g, "")) || 0 : 0;
const videos = [];
for (let i = 1; i <= qtdVideos; i++) {
  videos.push(`assets/images/${pasta}/${idGerado}-video-${i}.mp4`);
}

let novoItem = {};

if (tipo === "veiculo") {
  const matchAno =
    textoLimpo.match(/ano\s*:?\s*(\d{2,4})/i) ||
    textoLimpo.match(/\b(19\d{2}|20\d{2})\b/);
  let ano = matchAno ? matchAno[1] : "";
  if (ano.length === 2) ano = (parseInt(ano) > 30 ? "19" : "20") + ano;

  const t = textoLimpo.toLowerCase();
  const combustivel = t.includes("diesel")
    ? "Diesel"
    : t.includes("gasolina")
      ? "Gasolina"
      : "Flex";

  novoItem = {
    id: idGerado,
    titulo: titulo,
    categoria: categoria,
    ano: ano,
    km: extrairKm(textoLimpo),
    combustivel:
      categoria === "Caminhão" || categoria === "Carreta"
        ? "Diesel"
        : combustivel,
    preco: preco,
    descricao: textoLimpo,
    fotos: fotos,
    videos: videos,
  };
} else {
  novoItem = {
    id: idGerado,
    titulo: titulo,
    categoria: categoria,
    area: extrairArea(textoLimpo),
    localizacao: extrairLocalizacao(textoLimpo),
    preco: preco,
    descricao: textoLimpo,
    fotos: fotos,
    videos: videos,
  };
}

dados.push(novoItem);
fs.writeFileSync(caminhoArquivo, JSON.stringify(dados, null, 2), "utf-8");

console.log(`\n✅ Sucesso! Novo ${tipo} adicionado:`);
console.log(novoItem);
