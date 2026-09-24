import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Argumentos: node cadastrar.js <tipo> "<texto>" [qtd_fotos]
const tipo = process.argv[2];
const textoBruto = process.argv[3];
const qtdFotos = parseInt(process.argv[4]) || 1; // Padrão: 1 foto se não for informado

if (!tipo || !textoBruto) {
  console.log(
    '❌ Uso correto: node cadastrar.js <veiculo|imovel> "<texto>" [qtd_fotos]',
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

// Limpeza geral do texto do WhatsApp
function limparTexto(texto) {
  return texto
    .replace(/\[\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}\]\s*[^:]+:\s*/g, "") // Remove cabeçalhos do WhatsApp
    .replace(/\s+/g, " ") // Substitui múltiplos espaços por um único
    .trim();
}

function extrairPreco(texto) {
  // Trata "Valor 150." ou "150 mil" ou "150.000"
  const matchMil =
    texto.match(/valor\s*:?\s*(\d{2,3})\b\./i) ||
    texto.match(/(\d{2,3})\s*mil/i);
  if (matchMil) {
    return `${matchMil[1]}.000,00`;
  }

  const matchCompleto = texto.match(/(\d{1,3}(\.\d{3})+,\d{2})/);
  if (matchCompleto) return matchCompleto[0];

  const matchSimples = texto.match(/valor\s*:?\s*([\d\.]+)/i);
  if (matchSimples) {
    let p = matchSimples[1].replace(/\.$/, "");
    return p.includes(",") ? p : `${p},00`;
  }

  return "";
}

function extrairCategoria(texto, tipo) {
  const t = texto.toLowerCase();
  if (tipo === "imovel") {
    if (t.includes("terreno")) return "Terreno";
    if (t.includes("chácara") || t.includes("chacara")) return "Chácara";
    if (t.includes("sitio") || t.includes("sítio")) return "Sítio";
    if (t.includes("apartamento") || t.includes("apto")) return "Apartamento";
    if (t.includes("casa")) return "Casa";
    return "Imóvel";
  } else {
    if (
      t.includes("caminhão") ||
      t.includes("caminhao") ||
      t.includes("f600") ||
      t.includes("mb") ||
      t.includes("vw")
    )
      return "Caminhão";
    if (
      t.includes("caminhonete") ||
      t.includes("ranger") ||
      t.includes("f1000")
    )
      return "Caminhonete";
    return "Carro";
  }
}

function extrairLocalizacao(texto) {
  const cidades = [
    "hortolândia",
    "hortolandia",
    "sumaré",
    "sumare",
    "campinas",
    "paulínia",
    "paulinia",
    "monte mor",
  ];
  const t = texto.toLowerCase();

  for (const c of cidades) {
    if (t.includes(c)) {
      // Procura por expressões como "próximo hortolândia" ou apenas a cidade
      const matchProx = texto.match(new RegExp(`(próximo\\s+)?${c}`, "i"));
      return matchProx ? matchProx[0] : c;
    }
  }
  return "";
}

function extrairTitulo(texto, categoria) {
  const t = texto.toLowerCase();
  // Busca por nome de condomínio ou bairro no texto
  const matchCond = texto.match(
    /condomínio\s+([a-záàâãéèêíóôõúç0-9\s]+?)(?=\.|\,|$)/i,
  );
  if (matchCond) {
    return `${categoria} ${matchCond[0]}`.replace(/\s+/g, " ").trim();
  }
  return `${categoria} à venda`;
}

// Processamento
const textoLimpo = limparTexto(textoBruto);
const preco = extrairPreco(textoLimpo);
const categoria = extrairCategoria(textoLimpo, tipo);
const localizacao = extrairLocalizacao(textoLimpo);
const titulo = extrairTitulo(textoLimpo, categoria);
const idGerado = `${tipo}-${Date.now().toString().slice(-4)}`;

// Gera lista de fotos dinamicamente conforme a quantidade informada
const fotos = [];
const pasta = tipo === "veiculo" ? "veiculos" : "imoveis";
for (let i = 1; i <= qtdFotos; i++) {
  fotos.push(`assets/images/${pasta}/${idGerado}-${i}.webp`);
}

let novoItem = {};

if (tipo === "imovel") {
  novoItem = {
    id: idGerado,
    titulo: titulo,
    categoria: categoria,
    area: "",
    localizacao: localizacao,
    preco: preco,
    descricao: textoLimpo,
    fotos: fotos,
  };
} else {
  const matchAno =
    textoLimpo.match(/ano\s*:?\s*(\d{2,4})/i) ||
    textoLimpo.match(/\b(19\d{2}|20\d{2})\b/);
  let ano = matchAno ? matchAno[1] : "";
  if (ano.length === 2) ano = (parseInt(ano) > 30 ? "19" : "20") + ano;

  novoItem = {
    id: idGerado,
    titulo: titulo,
    categoria: categoria,
    ano: ano,
    km: "",
    combustivel: "Diesel",
    preco: preco,
    descricao: textoLimpo,
    fotos: fotos,
  };
}

dados.push(novoItem);
fs.writeFileSync(caminhoArquivo, JSON.stringify(dados, null, 2), "utf-8");

console.log(`\n✅ Sucesso! Novo ${tipo} adicionado com ${qtdFotos} foto(s):`);
console.log(novoItem);
