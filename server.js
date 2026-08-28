import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
 * Busca a senha descriptografada na API do RBX
 */
async function buscarSenhaApiRbx(url, apiKey, contrato) {
  if (!url || !apiKey) return null;

  const contratoSanitizado = contrato.toString().replace(/[^a-zA-Z0-9_-]/g, '');

  const payload = {
    ConsultaAutenticacaoSenha: {
      Autenticacao: {
        ChaveIntegracao: apiKey
      },
      Filtro: `Contrato = '${contratoSanitizado}'`
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return null;

    const data = await res.json();

    if (data?.status === 1 && Array.isArray(data?.result) && data.result.length > 0) {
      const auth = data.result.find(r => r.NAS !== '(CENTRAL ASSINANTE)' && r.NAS !== '-2') || data.result[0];
      if (auth) {
        return {
          usuario: auth.Usuario || auth.usuario || '',
          senha: auth.Senha || auth.senha || ''
        };
      }
    }
  } catch {
    // Falha silenciosa
  }

  return null;
}

/**
 * Consulta de Contrato no RBX (Híbrido: Módulo de Redes + Observações + API)
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

  // 1. CONSULTA AO BANCO DE DADOS MYSQL
  if (isDbConfigured) {
    try {
      const connection = await mysql.createConnection({
        host: env.dbHost,
        port: env.dbPort,
        user: env.dbUser,
        password: env.dbPassword,
        database: env.dbName,
        connectTimeout: 5000
      });

      // A) Busca Contrato
      const [contratoRows] = await connection.execute(
        'SELECT Numero, Cliente, Observacoes, SiciTecnologia, SiciMeioTransmissao FROM Contratos WHERE Numero = ? LIMIT 1',
        [contrato]
      ).catch(() => [[]]);

      if (contratoRows.length > 0) {
        clienteId = contratoRows[0].Cliente;
        if (contratoRows[0].Observacoes) {
          observacoesCompletas += contratoRows[0].Observacoes + '\n';
        }
      }

      // B) Busca no MÓDULO DE REDES FTTH (ClientesRede + GWRedesElementos)
      // Esta é a documentação nativa de caixas (CTOs) do RBX
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

      // C) Busca Usuário PPPoE na tabela ClientesUsuarios
      const [authRows] = await connection.execute(
        `SELECT id, Cliente, Contrato, Usuario, Senha, MAC, Observacao, Perfil_Central, NAS 
         FROM ClientesUsuarios 
         WHERE Contrato = ? 
         ORDER BY (Perfil_Central = 0) DESC, id DESC`,
        [contrato]
      ).catch(() => [[]]);

      if (authRows.length > 0) {
        const pppoeRow = authRows.find(r => r.Perfil_Central === 0 || (r.NAS !== '-2' && r.NAS !== -2)) || authRows[0];
        usuarioPPPoE = pppoeRow.Usuario || '';
        if (!clienteId && pppoeRow.Cliente) {
          clienteId = pppoeRow.Cliente;
        }
        if (pppoeRow.Observacao) {
          observacoesCompletas += pppoeRow.Observacao + '\n';
        }
      }

      // D) Busca Dados do Cliente na tabela Clientes
      if (clienteId) {
        const [cliRows] = await connection.execute(
          `SELECT Codigo, Nome, Endereco, Numero, Complemento, Bairro, Cidade, UF, CEP,
                  TelComercial, TelResidencial, TelCelular, Observacoes 
           FROM Clientes 
           WHERE Codigo = ? LIMIT 1`,
          [clienteId]
        ).catch(() => [[]]);

        if (cliRows.length > 0) {
          const cli = cliRows[0];
          
          if (cli.Observacoes) {
            observacoesCompletas = cli.Observacoes + '\n' + observacoesCompletas;
          }

          // Prioridade do telefone: TelCelular -> TelResidencial -> TelComercial
          const foneRaw = cli.TelCelular || cli.TelResidencial || cli.TelComercial || '';
          const foneFmt = formatarTelefone(foneRaw);
          const nome = (cli.Nome || '').trim();
          contato = foneFmt ? `${foneFmt}${nome ? ` - ${nome}` : ''}` : nome;

          const partesEnd = [];
          if (cli.Endereco) partesEnd.push(cli.Endereco);
          if (cli.Numero) partesEnd.push(`nº ${cli.Numero}`);
          if (cli.Complemento) partesEnd.push(`(${cli.Complemento})`);
          if (cli.Bairro) partesEnd.push(cli.Bairro);
          if (cli.Cidade) partesEnd.push(`${cli.Cidade}/${cli.UF || ''}`);
          
          pontoReferencia = partesEnd.join(', ');
        }
      }

      // E) Endereço de Instalação (se houver em ContratosEndereco)
      const [endInstRows] = await connection.execute(
        `SELECT Endereco, Numero, Complemento, Bairro, Cidade, UF, CEP 
         FROM ContratosEndereco 
         WHERE Contrato = ? AND Tipo = 'I' LIMIT 1`,
        [contrato]
      ).catch(() => [[]]);

      if (endInstRows.length > 0) {
        const endInst = endInstRows[0];
        const partesInst = [];
        if (endInst.Endereco) partesInst.push(endInst.Endereco);
        if (endInst.Numero) partesInst.push(`nº ${endInst.Numero}`);
        if (endInst.Complemento) partesInst.push(`(${endInst.Complemento})`);
        if (endInst.Bairro) partesInst.push(endInst.Bairro);
        if (endInst.Cidade) partesInst.push(`${endInst.Cidade}/${endInst.UF || ''}`);
        
        if (partesInst.length > 0) {
          pontoReferencia = partesInst.join(', ');
        }
      }

      // Se a caixa não foi encontrada no módulo de rede ClientesRede, faz o fallback para as Observações
      if (!caixaPosicao) {
        caixaPosicao = extrairCaixaPosicao(observacoesCompletas);
      }

      await connection.end();

    } catch (dbErr) {
      console.error('[DB Error]: Falha na consulta ao banco.');
    }
  }

  // 2. CONSULTA SENHA DESCRIPTOGRAFADA NA API DO RBX
  if (isRbxApiConfigured) {
    try {
      const authApiResult = await buscarSenhaApiRbx(env.rbxUrl, env.rbxKey, contrato);
      if (authApiResult) {
        if (authApiResult.usuario) usuarioPPPoE = authApiResult.usuario;
        if (authApiResult.senha) senhaPPPoE = authApiResult.senha;
      }
    } catch {
      // Ignora falhas de API
    }
  }

  // Retorno com dados
  if (usuarioPPPoE || caixaPosicao || contato || pontoReferencia) {
    const pppoeFormatado = usuarioPPPoE ? (senhaPPPoE ? `${usuarioPPPoE} / ${senhaPPPoE}` : usuarioPPPoE) : '';

    return res.json({
      sucesso: true,
      origem: senhaPPPoE ? 'RBX Banco + API' : 'Banco de Dados RBX',
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
    erro: `Contrato ${contrato} não encontrado no banco de dados do RBX.`
  });
});

// Fallback para React Router / SPA em produção
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Servidor Produção] Rodando na porta ${PORT} (http://localhost:${PORT})`);
});
