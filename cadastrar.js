import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Argumentos: node cadastrar.js <tipo> "<texto>" [qtd_fotos] [categoria_opcional]
const tipo = process.argv[2];
const textoBruto = process.argv[3];
// Verifica se o 4º argumento é número ou nome de categoria
const arg4 = process.argv[4];
const arg5 = process.argv[5];

const qtdFotos = !isNaN(parseInt(arg4))
  ? parseInt(arg4)
  : !isNaN(parseInt(arg5))
    ? parseInt(arg5)
    : 1;
const categoriaInformada = isNaN(parseInt(arg4)) ? arg4 : arg5;

if (!tipo || !textoBruto) {
  console.log(
    '❌ Uso correto: node cadastrar.js <veiculo|imovel> "<texto>" [qtd_fotos] [categoria_opcional]',
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

// Limpeza geral do texto
function limparTexto(texto) {
  return texto
    .replace(/\[\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}\]\s*[^:]+:\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairPreco(texto) {
  const matchMil =
    texto.match(/valor\s*:?\s*(\d{2,3})\b\./i) ||
    texto.match(/(\d{2,3})\s*mil/i);
  if (matchMil) return `${matchMil[1]}.000,00`;

  const matchCompleto = texto.match(/(\d{1,3}(\.\d{3})+,\d{2})/);
  if (matchCompleto) return matchCompleto[0];

  const matchSimples = texto.match(/valor\s*:?\s*([\d\.]+)/i);
  if (matchSimples) {
    let p = matchSimples[1].replace(/\.$/, "");
    return p.includes(",") ? p : `${p},00`;
  }

  return "";
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
    // 1. Carreta / Conjunto
    if (
      t.includes("carreta") ||
      t.includes("cavalo") ||
      t.includes("conjunto") ||
      t.includes("bitrem") ||
      t.includes("bi-trem") ||
      t.includes("rodotrem")
    ) {
      return "Carreta";
    }

    // 2. Caminhão
    if (
      t.includes("caminhão") ||
      t.includes("caminhao") ||
      t.includes("f600") ||
      t.includes("mb ") ||
      t.includes("vw ") ||
      t.includes("scania") ||
      t.includes("volvo") ||
      t.includes("iveco")
    ) {
      return "Caminhão";
    }

    // 3. Caminhonete
    if (
      t.includes("caminhonete") ||
      t.includes("hilux") ||
      t.includes("s10") ||
      t.includes("ranger") ||
      t.includes("f1000") ||
      t.includes("strada") ||
      t.includes("saveiro") ||
      t.includes("montana") ||
      t.includes("ram") ||
      t.includes("l200")
    ) {
      return "Caminhonete";
    }

    // 4. Moto
    if (
      t.includes("moto") ||
      t.includes("honda") ||
      t.includes("yamaha") ||
      t.includes("cg ") ||
      t.includes("titan") ||
      t.includes("biz") ||
      t.includes("fan ") ||
      t.includes("bros") ||
      t.includes("xre") ||
      t.includes("cb ")
    ) {
      return "Moto";
    }

    // 5. Padrão para os demais veículos
    return "Carro";
  }
}

function extrairTitulo(texto, categoria, tipo) {
  if (tipo === "veiculo") {
    // Pega as 3 primeiras palavras do texto para formar o título (Ex: "Palio Weekend 1.6")
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

// Monta lista de fotos
const fotos = [];
const pasta = tipo === "veiculo" ? "veiculos" : "imoveis";
for (let i = 1; i <= qtdFotos; i++) {
  fotos.push(`assets/images/${pasta}/${idGerado}-${i}.webp`);
}

let novoItem = {};

if (tipo === "veiculo") {
  const matchAno =
    textoLimpo.match(/ano\s*:?\s*(\d{2,4})/i) ||
    textoLimpo.match(/\b(19\d{2}|20\d{2})\b/) ||
    textoLimpo.match(/\b(\d{2})\b/);
  let ano = matchAno ? matchAno[1] : "";
  if (ano.length === 2) ano = (parseInt(ano) > 30 ? "19" : "20") + ano;

  novoItem = {
    id: idGerado,
    titulo: titulo,
    categoria: categoria,
    ano: ano,
    km: "",
    combustivel: categoria === "Caminhão" ? "Diesel" : "Flex", // Ajuste dinâmico
    preco: preco,
    descricao: textoLimpo,
    fotos: fotos,
  };
} else {
  novoItem = {
    id: idGerado,
    titulo: titulo,
    categoria: categoria,
    area: "",
    localizacao: "",
    preco: preco,
    descricao: textoLimpo,
    fotos: fotos,
  };
}

dados.push(novoItem);
fs.writeFileSync(caminhoArquivo, JSON.stringify(dados, null, 2), "utf-8");

console.log(`\n✅ Sucesso! Novo ${tipo} adicionado:`);
console.log(novoItem);
