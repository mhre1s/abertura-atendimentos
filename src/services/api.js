/**
 * Serviço de Integração com o Backend Local
 */

const API_BASE_URL = '/api';

/**
 * Busca dados do contrato, autenticação PPPoE e dados do cliente
 * @param {string} contrato - Número do contrato SCM
 */
export async function buscarDadosContrato(contrato) {
  const contratoLimpo = (contrato || '').trim();
  if (!contratoLimpo) {
    throw new Error('Informe o número do contrato SCM.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/consulta/${encodeURIComponent(contratoLimpo)}`);
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.erro || `Erro na consulta (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao consultar contrato:', error);
    throw error;
  }
}
