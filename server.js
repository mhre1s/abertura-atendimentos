import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve os arquivos estáticos do React em produção
app.use(express.static(path.join(__dirname, 'dist')));

/**
 * Recarrega variáveis do .env a cada requisição de forma segura
 */
function getEnvConfig() {
  dotenv.config({ override: true });
  return {
    rbxUrl: (process.env.RBX_API_URL || process.env.RBX_BASE_URL || '').trim(),
    rbxKey: (process.env.RBX_API_KEY || '').trim(),
    dbType: process.env.DB_TYPE || 'mysql',
    dbHost: (process.env.DB_HOST || '').trim(),
    dbPort: Number(process.env.DB_PORT) || 3306,
    dbUser: (process.env.DB_USER || '').trim(),
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: (process.env.DB_NAME || '').trim()
  };
}

/**
 * Formata telefone brasileiro para (XX) XXXXX-XXXX
 */
function formatarTelefone(fone) {
  if (!fone) return '';
  const num = fone.toString().replace(/\D/g, '');
  if (num.length === 11) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  }
  if (num.length === 10) {
    return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`;
  }
  return fone;
}

/**
 * Extrai caixa e posição das observações do cliente
 */
function extrairCaixaPosicao(observacoes) {
  if (!observacoes) return '';
  const texto = observacoes.toString().trim();
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const linhaCaixa = linhas.find(l => /caixa|cto|porta|posi/i.test(l));
  
  if (linhaCaixa) {
    return linhaCaixa;
  }
  return linhas[0] || texto;
}

/**
 * Seleciona a autenticação de Fibra Óptica / PPPoE
 * (Ignora CPF da Central do Assinante e prioriza autenticação com MAC de ONU/CPE, NAS padrão e ID mais recente)
 */
function selecionarMelhorPPPoE(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return null;

  // Filtra registros que são puramente Central do Assinante / CPF
  const candidatos = lista.filter(r => {
    const nas = (r.NAS || r.nas || '').toString();
    const perfil = r.Perfil_Central || r.perfil_central;
    const user = (r.Usuario || r.usuario || '').toString().trim();
    const obs = (r.Observacao || r.observacao || r.Observacoes || '').toString();

    if (nas === '(CENTRAL ASSINANTE)' || nas === '-2' || perfil === 1 || perfil === '1') return false;
    if (obs.toUpperCase().includes('CENTRAL DO ASSINANTE')) return false;
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(user)) return false;
    return true;
  });

  const pool = candidatos.length > 0 ? candidatos : lista;

  return pool.slice().sort((a, b) => {
    const macA = (a.MAC || a.mac || '').toString().trim();
    const macB = (b.MAC || b.mac || '').toString().trim();
    const nasA = (a.NAS || a.nas || '').toString();
    const nasB = (b.NAS || b.nas || '').toString();
    const senhaA = (a.Senha || a.senha || '').toString();
    const senhaB = (b.Senha || b.senha || '').toString();
    const idA = Number(a.Id || a.id) || 0;
    const idB = Number(b.Id || b.id) || 0;

    let scoreA = 0;
    let scoreB = 0;

    // Prioridade 1: Possui endereço MAC de ONU / CPE cadastrado (identifica fibra óptica)
    if (macA.length > 0) scoreA += 10;
    if (macB.length > 0) scoreB += 10;

    // Prioridade 2: NAS padrão de autenticação PPPoE de internet ((TODOS) ou -1)
    if (nasA === '(TODOS)' || nasA === '-1') scoreA += 5;
    if (nasB === '(TODOS)' || nasB === '-1') scoreB += 5;

    // Prioridade 3: Possui senha preenchida
    if (senhaA.length > 0) scoreA += 3;
    if (senhaB.length > 0) scoreB += 3;

    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    // Desempate pelo cadastro mais recente (ID maior)
    return idB - idA;
  })[0];
}

/**
 * Busca dados completos via API do RBX (Autenticações + Clientes)
 * Funciona 100% mesmo quando o MySQL remoto estiver bloqueado pelo firewall na Cloud
 */
async function buscarDadosApiRbx(url, apiKey, contrato) {
  if (!url || !apiKey) return null;

  const contratoSanitizado = contrato.toString().replace(/[^a-zA-Z0-9_-]/g, '');

  try {
    // 1. Consulta Autenticação PPPoE com Senha
    const authPayload = {
      ConsultaAutenticacaoSenha: {
        Autenticacao: { ChaveIntegracao: apiKey },
        Filtro: `Contrato = '${contratoSanitizado}'`
      }
    };

    const resAuth = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authPayload),
      signal: AbortSignal.timeout(5000)
    });

    if (!resAuth.ok) return null;

    const dataAuth = await resAuth.json();
    if (!dataAuth || dataAuth.status !== 1 || !Array.isArray(dataAuth.result) || dataAuth.result.length === 0) {
      return null;
    }

    // Seleciona a autenticação PPPoE real correta
    const auth = selecionarMelhorPPPoE(dataAuth.result);
    if (!auth) return null;

    const usuarioPPPoE = auth.Usuario || auth.usuario || '';
    const senhaPPPoE = auth.Senha || auth.senha || '';
    const clienteId = auth.Cliente || auth.cliente || '';
    let observacoes = auth.Observacao || auth.observacao || '';
    let contato = '';
    let pontoReferencia = '';

    // 2. Se temos o ID do Cliente, busca os dados cadastrais (Observações/Caixa, Contatos, Endereço)
    if (clienteId) {
      try {
        const clientPayload = {
          ConsultaClientes: {
            Autenticacao: { ChaveIntegracao: apiKey },
            Filtro: `Codigo = '${clienteId}'`
          }
        };

        const resCli = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientPayload),
          signal: AbortSignal.timeout(5000)
        });

        if (resCli.ok) {
          const dataCli = await resCli.json();
          if (dataCli?.status === 1 && Array.isArray(dataCli.result) && dataCli.result.length > 0) {
            const cli = dataCli.result[0];
            
            // Observações do cliente (onde fica a caixa)
            if (cli.Observacoes || cli.Observacao) {
              observacoes = cli.Observacoes || cli.Observacao;
            }

            // Contato (Prioridade: Celular -> Residencial -> Comercial)
            const foneRaw = cli.TelCelular || cli.TelResidencial || cli.TelComercial || '';
            const foneFmt = formatarTelefone(foneRaw);
            const nome = (cli.Nome || '').trim();
            contato = foneFmt ? `${foneFmt}${nome ? ` - ${nome}` : ''}` : nome;

            // Endereço / Ponto de Referência
            const partesEnd = [];
            if (cli.Endereco) partesEnd.push(cli.Endereco);
            if (cli.Numero) partesEnd.push(`nº ${cli.Numero}`);
            if (cli.Complemento) partesEnd.push(`(${cli.Complemento})`);
            if (cli.Bairro) partesEnd.push(cli.Bairro);
            if (cli.Cidade) partesEnd.push(`${cli.Cidade}/${cli.UF || ''}`);
            pontoReferencia = partesEnd.join(', ');
          }
        }
      } catch (cliErr) {
        console.warn('[RBX API] Aviso ao buscar dados do cliente:', cliErr.message);
      }
    }

    return {
      usuarioPPPoE,
      senhaPPPoE,
      caixaPosicao: extrairCaixaPosicao(observacoes),
      contato,
      pontoReferencia,
      clienteId,
      observacoesCompletas: observacoes
    };

  } catch (err) {
    console.error('[RBX API Error]:', err.message);
    return null;
  }
}

/**
 * Consulta de Contrato no RBX (API RBX + MySQL Resiliente)
 */
app.get('/api/consulta/:contrato', async (req, res) => {
  const contratoRaw = (req.params.contrato || '').trim();
  const contrato = contratoRaw.replace(/[^a-zA-Z0-9_-]/g, '');
  const env = getEnvConfig();

  if (!contrato) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Número do contrato inválido ou não fornecido.'
    });
  }

  const isDbConfigured = Boolean(env.dbHost && env.dbUser && !env.dbUser.includes('seu_usuario'));
  const isRbxApiConfigured = Boolean(env.rbxUrl && env.rbxKey);

  let usuarioPPPoE = '';
  let senhaPPPoE = '';
  let caixaPosicao = '';
  let emenda = '';
  let contato = '';
  let pontoReferencia = '';
  let clienteId = '';
  let observacoesCompletas = '';

  // 1. CONSULTA VIA API DO RBX (Funciona em qualquer lugar: Cloud / Local / VPS)
  if (isRbxApiConfigured) {
    const apiData = await buscarDadosApiRbx(env.rbxUrl, env.rbxKey, contrato);
    if (apiData) {
      usuarioPPPoE = apiData.usuarioPPPoE || '';
      senhaPPPoE = apiData.senhaPPPoE || '';
      caixaPosicao = apiData.caixaPosicao || '';
      contato = apiData.contato || '';
      pontoReferencia = apiData.pontoReferencia || '';
      clienteId = apiData.clienteId || '';
      observacoesCompletas = apiData.observacoesCompletas || '';
    }
  }

  // 2. COMPLEMENTA COM O BANCO DE DADOS MYSQL (Se o MySQL estiver acessível)
  if (isDbConfigured) {
    try {
      const connection = await mysql.createConnection({
        host: env.dbHost,
        port: env.dbPort,
        user: env.dbUser,
        password: env.dbPassword,
        database: env.dbName,
        connectTimeout: 3000
      });

      // Se a caixa ainda não foi encontrada, tenta pelo Módulo de Redes FTTH (ClientesRede)
      if (!caixaPosicao) {
        const [redeRows] = await connection.execute(
          `SELECT cr.RedeElemPorta, cr.Fibra, cr.Cabo, ge.Descricao as ElementoNome
           FROM ClientesRede cr
           LEFT JOIN GWRedesElementos ge ON ge.Codigo = cr.RedeElemento
           WHERE cr.Contrato = ? LIMIT 1`,
          [contrato]
        ).catch(() => [[]]);

        if (redeRows.length > 0 && redeRows[0].ElementoNome) {
          const r = redeRows[0];
          caixaPosicao = `${r.ElementoNome}${r.RedeElemPorta ? ` PORTA ${r.RedeElemPorta}` : ''}`;
        }
      }

      // Se o contato ainda não veio da API, busca na tabela Clientes
      if (!contato || !pontoReferencia) {
        if (!clienteId) {
          const [contratoRows] = await connection.execute(
            'SELECT Cliente FROM Contratos WHERE Numero = ? LIMIT 1',
            [contrato]
          ).catch(() => [[]]);
          if (contratoRows.length > 0) clienteId = contratoRows[0].Cliente;
        }

        if (clienteId) {
          const [cliRows] = await connection.execute(
            `SELECT Nome, Endereco, Numero, Complemento, Bairro, Cidade, UF, TelComercial, TelResidencial, TelCelular, Observacoes 
             FROM Clientes 
             WHERE Codigo = ? LIMIT 1`,
            [clienteId]
          ).catch(() => [[]]);

          if (cliRows.length > 0) {
            const cli = cliRows[0];
            if (!caixaPosicao) caixaPosicao = extrairCaixaPosicao(cli.Observacoes);
            
            if (!contato) {
              const foneRaw = cli.TelCelular || cli.TelResidencial || cli.TelComercial || '';
              const foneFmt = formatarTelefone(foneRaw);
              const nome = (cli.Nome || '').trim();
              contato = foneFmt ? `${foneFmt}${nome ? ` - ${nome}` : ''}` : nome;
            }

            if (!pontoReferencia) {
              const partesEnd = [];
              if (cli.Endereco) partesEnd.push(cli.Endereco);
              if (cli.Numero) partesEnd.push(`nº ${cli.Numero}`);
              if (cli.Complemento) partesEnd.push(`(${cli.Complemento})`);
              if (cli.Bairro) partesEnd.push(cli.Bairro);
              if (cli.Cidade) partesEnd.push(`${cli.Cidade}/${cli.UF || ''}`);
              pontoReferencia = partesEnd.join(', ');
            }
          }
        }
      }

      await connection.end();

    } catch (dbErr) {
      // Se o MySQL falhar na nuvem por firewall, os dados já vieram da API do RBX perfeitamente!
      console.warn('[DB Fallback]: Banco MySQL inacessível, utilizando dados da API RBX.');
    }
  }

  // Retorno com dados
  if (usuarioPPPoE || caixaPosicao || contato || pontoReferencia) {
    const pppoeFormatado = usuarioPPPoE ? (senhaPPPoE ? `${usuarioPPPoE} / ${senhaPPPoE}` : usuarioPPPoE) : '';

    return res.json({
      sucesso: true,
      origem: senhaPPPoE ? 'RBX Soft API (Produção)' : 'Banco de Dados RBX',
      contrato: contrato.toUpperCase(),
      caixaPosicao: (caixaPosicao || '').toUpperCase(),
      usuarioPPPoE: usuarioPPPoE,
      senhaPPPoE: senhaPPPoE,
      pppoe: pppoeFormatado,
      emenda: (emenda || '').toUpperCase(),
      contato: (contato || '').toUpperCase(),
      pontoReferencia: (pontoReferencia || '').toUpperCase()
    });
  }

  return res.status(404).json({
    sucesso: false,
    erro: `Contrato ${contrato} não encontrado no RBX.`
  });
});

// Fallback para React Router / SPA em produção
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Servidor Produção] Rodando na porta ${PORT} (http://localhost:${PORT})`);
});
