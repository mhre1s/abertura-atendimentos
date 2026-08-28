import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Radio, CheckCircle, AlertCircle } from 'lucide-react';
import AtendimentoForm from './components/AtendimentoForm';
import TextareaPreview from './components/TextareaPreview';
import HistoricoAtendimentos from './components/HistoricoAtendimentos';
import { buscarDadosContrato } from './services/api';

const STORAGE_KEY_HISTORY = 'abertura_los_history';

export default function App() {
  const [formData, setFormData] = useState({
    tipo: '#LOS#',
    contrato: '',
    caixaPosicao: '',
    sinal: '',
    pppoe: '',
    emenda: '',
    contato: '',
    pontoReferencia: ''
  });

  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Carrega histórico salvo
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Erro ao ler histórico:', e);
    }
  }, []);

  // Mostra Toast
  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 2800);
  }, []);

  // Manipulador de alteração dos inputs (converte tudo para MAIÚSCULO, exceto o PPPoE)
  const handleInputChange = (field, value) => {
    const finalValue = field === 'pppoe' ? value : value.toUpperCase();
    setFormData(prev => ({ ...prev, [field]: finalValue }));
  };

  // Limpar formulário
  const handleClear = () => {
    setFormData({
      tipo: '#LOS#',
      contrato: '',
      caixaPosicao: '',
      sinal: '',
      pppoe: '',
      emenda: '',
      contato: '',
      pontoReferencia: ''
    });
    showToast('Campos limpos!');
  };

  // Texto formatado gerado em tempo real
  // Quando for #SINAL_BAIXO#, adiciona a linha SINAL: logo após CAIXA E POSIÇÃO
  const generatedText = useMemo(() => {
    const tipo = (formData.tipo || '#LOS#').toUpperCase();
    const caixaPosicao = formData.caixaPosicao.trim().toUpperCase();
    const sinal = (formData.sinal || '').trim().toUpperCase();
    const pppoe = formData.pppoe.trim(); // Mantém original
    const emenda = formData.emenda.trim().toUpperCase();
    const contato = formData.contato.trim().toUpperCase();
    const pontoRef = formData.pontoReferencia.trim().toUpperCase();

    const linhas = [
      `${tipo}`,
      `CAIXA E POSIÇÃO: ${caixaPosicao}`
    ];

    if (tipo === '#SINAL_BAIXO#') {
      linhas.push(`SINAL: ${sinal}`);
    }

    linhas.push(
      `PPPoE: ${pppoe}`,
      `EMENDA: ${emenda}`,
      `CONTATO: ${contato}`,
      `PONTO DE REFERÊNCIA: ${pontoRef}`
    );

    return linhas.join('\n');
  }, [formData]);

  // Salvar no histórico
  const saveToHistory = useCallback((notificar = true) => {
    if (!formData.contrato.trim() && !formData.pppoe.trim()) {
      if (notificar) showToast('Preencha o Contrato SCM ou PPPoE para salvar.', 'error');
      return;
    }

    const newItem = {
      id: Date.now(),
      tipo: formData.tipo.toUpperCase(),
      contrato: formData.contrato.trim().toUpperCase(),
      caixaPosicao: formData.caixaPosicao.trim().toUpperCase(),
      sinal: (formData.sinal || '').trim().toUpperCase(),
      pppoe: formData.pppoe.trim(),
      emenda: formData.emenda.trim().toUpperCase(),
      contato: formData.contato.trim().toUpperCase(),
      pontoRef: formData.pontoReferencia.trim().toUpperCase(),
      textoCompleto: generatedText,
      data: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setHistory(prev => {
      const filtered = prev.filter(h => h.contrato !== newItem.contrato || h.tipo !== newItem.tipo);
      const updated = [newItem, ...filtered].slice(0, 15);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      return updated;
    });

    if (notificar) {
      showToast('Atendimento salvo no histórico!');
    }
  }, [formData, generatedText, showToast]);

  // Copiar para clipboard
  const handleCopy = async (text) => {
    if (!text) {
      showToast('Nada para copiar.', 'error');
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Texto copiado para a área de transferência!');
      saveToHistory(false);
      return true;
    } catch (err) {
      console.error('Erro ao copiar:', err);
      showToast('Erro ao copiar texto.', 'error');
      return false;
    }
  };

  // Busca de Contrato no RBX
  const handleSearchContract = async () => {
    const contratoVal = formData.contrato.trim();
    if (!contratoVal) {
      showToast('Digite o número do Contrato SCM antes de buscar.', 'error');
      return;
    }

    setIsSearching(true);
    try {
      const dados = await buscarDadosContrato(contratoVal);
      setFormData(prev => ({
        ...prev,
        caixaPosicao: (dados.caixaPosicao || prev.caixaPosicao || '').toUpperCase(),
        pppoe: dados.pppoe || prev.pppoe,
        emenda: (dados.emenda || prev.emenda || '').toUpperCase(),
        contato: (dados.contato || prev.contato || '').toUpperCase(),
        pontoReferencia: (dados.pontoReferencia || prev.pontoReferencia || '').toUpperCase()
      }));
      showToast(`Dados preenchidos com sucesso!`);
    } catch (err) {
      showToast(err.message || 'Erro ao consultar contrato no RBX.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Restaurar item do histórico
  const handleRestoreHistory = (item) => {
    setFormData({
      tipo: item.tipo,
      contrato: item.contrato,
      caixaPosicao: item.caixaPosicao || '',
      sinal: item.sinal || '',
      pppoe: item.pppoe || '',
      emenda: item.emenda || '',
      contato: item.contato || '',
      pontoReferencia: item.pontoRef || ''
    });
    showToast(`Contrato ${item.contrato} carregado!`);
  };

  // Copiar direto do histórico
  const handleCopyDirectHistory = async (texto, contrato) => {
    try {
      await navigator.clipboard.writeText(texto);
      showToast(`Texto do contrato ${contrato} copiado!`);
    } catch {
      showToast('Erro ao copiar item.', 'error');
    }
  };

  // Limpar histórico
  const handleClearHistory = () => {
    if (window.confirm('Deseja realmente limpar todo o histórico de atendimentos recentes?')) {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      setHistory([]);
      showToast('Histórico limpo.');
    }
  };

  // Atalho global Ctrl + Enter
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleCopy(generatedText);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [generatedText]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header Limpo */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Abertura de Atendimento & LOS</h1>
              <p className="text-xs text-slate-500 font-medium">Gerador automático de chamado para SCM e suporte técnico</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Formulário (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            <AtendimentoForm
              formData={formData}
              onChange={handleInputChange}
              onClear={handleClear}
              onSearchContract={handleSearchContract}
              isSearching={isSearching}
              onSaveHistory={() => saveToHistory(true)}
            />
          </div>

          {/* Right: Textarea e Histórico (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            <TextareaPreview
              generatedText={generatedText}
              formData={formData}
              onCopy={handleCopy}
              onShowToast={showToast}
            />

            <HistoricoAtendimentos
              history={history}
              onRestore={handleRestoreHistory}
              onCopyDirect={handleCopyDirectHistory}
              onClearHistory={handleClearHistory}
            />
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-3 transition-all duration-300">
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
