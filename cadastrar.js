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
  return texto
    .replace(/\[\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}\]\s*[^:]+:\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairPreco(texto) {
  // Captura formatos como: Valor. 57.800 / Valor 57800 / 57.800,00
  const matchComRotulo = texto.match(/valor\s*:?\s*\.?\s*([\d\.]+)/i);
  if (matchComRotulo) {
    let p = matchComRotulo[1].replace(/\.$/, ""); // remove ponto final se houver
    if (!p.includes(",")) {
      // Se tiver só milhar (ex: 57.800 ou 57800)
      if (p.includes(".")) return `${p},00`;
      if (p.length >= 4) return `${p.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},00`;
      return `${p}.000,00`;
    }
    return p;
  }

  const matchMil = texto.match(/(\d{2,3})\s*mil/i);
  if (matchMil) return `${matchMil[1]}.000,00`;

  return "";
}

function extrairKm(texto) {
  // Captura: KL. 180 / KM 180 / 180.000 km / 180k
  const matchKm =
    texto.match(/(?:km|kl)\s*:?\s*\.?\s*(\d+([\.,]\d+)?)/i) ||
    texto.match(/(\d{1,3}(\.\d{3})*|\d+)\s*(km|mil km)/i);

  if (matchKm) {
    let val = matchKm[1];
    // Se o valor for curto como "180", formata para "180.000 KM" ou "180 KM"
    return val.length <= 3 ? `${val}.000 KM` : `${val} KM`;
  }
  return "N/A";
}

function extrairArea(texto) {
  const matchArea = texto.match(/(\d+(\.\d+)?)\s*(m²|m2|alqueires|hectares)/i);
  return matchArea ? matchArea[0] : "";
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
    const palavras = texto.split(" ");
    const modelo = palavras
      .slice(0, 3)
      .join(" ")
      .replace(/[,.-]$/, "");
    return modelo || `${categoria} à venda`;
  } else {
    const matchCond = texto.match(
      /condomínio\s+([a-záàâãéèêíóôõúç0-9\s]+?)(?=\.|\,|$)/i,
    );
    if (matchCond)
      return `${categoria} ${matchCond[0]}`.replace(/\s+/g, " ").trim();
    return `${categoria} à venda`;
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

// Extração e Geração dos Vídeos
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
    localizacao: "",
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
