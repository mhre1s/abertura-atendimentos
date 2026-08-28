import React from 'react';
import { History, Copy, Trash2 } from 'lucide-react';

export default function HistoricoAtendimentos({
  history,
  onRestore,
  onCopyDirect,
  onClearHistory
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-slate-600" />
          <h3 className="text-sm font-bold text-slate-800">Histórico Recente</h3>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-[11px] text-slate-400 hover:text-red-500 transition-colors flex items-center cursor-pointer"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Limpar Histórico
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4">
            Nenhum atendimento salvo recentemente.
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="p-2.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs transition-colors group cursor-pointer"
            >
              <div
                className="flex-1 min-w-0 pr-2"
                onClick={() => onRestore(item)}
                title="Clique para carregar no formulário"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800 truncate">{item.tipo}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-blue-600 truncate">SCM: {item.contrato}</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {item.caixaPosicao ? `${item.caixaPosicao} | ` : ''}{item.pppoe ? `PPPoE: ${item.pppoe}` : (item.contato ? item.contato : '')}
                </div>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <span className="text-[10px] text-slate-400 font-mono mr-1">{item.data}</span>
                <button
                  type="button"
                  title="Copiar texto gerado deste item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyDirect(item.textoCompleto, item.contrato);
                  }}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-500 hover:text-blue-600 shadow-none hover:shadow-sm transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
