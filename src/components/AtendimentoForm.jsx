import React from 'react';
import { 
  FileEdit, 
  Trash2, 
  ChevronDown, 
  ZapOff, 
  WifiOff, 
  Wrench, 
  FastForward, 
  Hash, 
  Search, 
  Loader2, 
  Box,
  KeyRound,
  GitCommit, 
  Phone, 
  MapPin, 
  Bookmark, 
  Sparkles 
} from 'lucide-react';

const TIPOS_ATENDIMENTO = [
  { value: '#DYING_GASP#', label: '#DYING_GASP#', icon: ZapOff, color: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' },
  { value: '#LOS#', label: '#LOS#', icon: WifiOff, color: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100' },
  { value: '#VISITA_TECNICA#', label: '#VISITA_TECNICA#', icon: Wrench, color: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100' },
  { value: '#FAST#', label: '#FAST#', icon: FastForward, color: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
];

export default function AtendimentoForm({
  formData,
  onChange,
  onClear,
  onSearchContract,
  isSearching,
  onSaveHistory
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearchContract();
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <FileEdit className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">Preenchimento do Atendimento</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-red-600 flex items-center font-medium transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          Limpar Campos
        </button>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        
        {/* 1. Tipo de Atendimento */}
        <div>
          <label htmlFor="tipo" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Tipo de Atendimento <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="tipo"
              name="tipo"
              value={formData.tipo}
              onChange={(e) => onChange('tipo', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 pr-10 appearance-none transition-all outline-none uppercase"
            >
              <option value="#DYING_GASP#">#DYING_GASP#</option>
              <option value="#LOS#">#LOS#</option>
              <option value="#VISITA_TECNICA#">#VISITA_TECNICA#</option>
              <option value="#FAST#">#FAST#</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          {/* Quick Select Chips */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {TIPOS_ATENDIMENTO.map((item) => {
              const Icon = item.icon;
              const isActive = formData.tipo === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onChange('tipo', item.value)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center transition-all cursor-pointer uppercase ${
                    item.color
                  } ${isActive ? 'ring-2 ring-blue-600 shadow-sm font-bold scale-[1.02]' : 'opacity-80 hover:opacity-100'}`}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Contrato SCM + Busca Automática no RBX */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="contrato" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Contrato SCM <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-slate-400 font-medium">
              Enter para buscar no RBX
            </span>
          </div>
          <div className="flex rounded-xl shadow-sm">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                id="contrato"
                name="contrato"
                value={formData.contrato}
                onChange={(e) => onChange('contrato', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: 104523"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm font-medium rounded-l-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all uppercase outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onSearchContract}
              disabled={isSearching}
              title="Consultar dados do contrato no RBX"
              className="inline-flex items-center px-4 py-2.5 border border-l-0 border-blue-600 rounded-r-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5 mr-1.5" />
                  <span>Buscar RBX</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. Caixa e Posição (MAIÚSCULO) */}
        <div>
          <label htmlFor="caixaPosicao" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Caixa e Posição
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Box className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="caixaPosicao"
              name="caixaPosicao"
              value={formData.caixaPosicao}
              onChange={(e) => onChange('caixaPosicao', e.target.value)}
              placeholder="Ex: CTO-04 PORTA 02"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all uppercase outline-none font-semibold"
            />
          </div>
        </div>

        {/* 4. PPPoE (Usuário / Senha mantidos no formato original) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="pppoe" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              PPPoE (Usuário / Senha)
            </label>
            <span className="text-[11px] text-slate-400 font-medium">
              Case sensitive
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="pppoe"
              name="pppoe"
              value={formData.pppoe}
              onChange={(e) => onChange('pppoe', e.target.value)}
              placeholder="Ex: usuario@provedor.com.br / senha"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none font-mono"
            />
          </div>
        </div>

        {/* 5. Emenda (MAIÚSCULO) */}
        <div>
          <label htmlFor="emenda" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Emenda
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <GitCommit className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="emenda"
              name="emenda"
              value={formData.emenda}
              onChange={(e) => onChange('emenda', e.target.value)}
              placeholder="Ex: EM-04-CX02"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all uppercase outline-none"
            />
          </div>
        </div>

        {/* 6. Contato (MAIÚSCULO) */}
        <div>
          <label htmlFor="contato" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Contato
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Phone className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="contato"
              name="contato"
              value={formData.contato}
              onChange={(e) => onChange('contato', e.target.value)}
              placeholder="Ex: (11) 98765-4321 - JOÃO SILVA"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all uppercase outline-none"
            />
          </div>
        </div>

        {/* 7. Ponto de Referência (MAIÚSCULO) */}
        <div>
          <label htmlFor="pontoReferencia" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Ponto de Referência
          </label>
          <div className="relative">
            <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none text-slate-400">
              <MapPin className="w-4 h-4" />
            </div>
            <textarea
              id="pontoReferencia"
              name="pontoReferencia"
              rows={2}
              value={formData.pontoReferencia}
              onChange={(e) => onChange('pontoReferencia', e.target.value)}
              placeholder="Ex: PRÓXIMO À PADARIA CENTRAL"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all uppercase outline-none resize-y"
            />
          </div>
        </div>

        {/* Card Footer */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
          <span className="flex items-center">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
            Textarea atualiza em tempo real
          </span>
          <button
            type="button"
            onClick={onSaveHistory}
            className="font-semibold text-blue-600 hover:text-blue-700 flex items-center cursor-pointer transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 mr-1" />
            Salvar no Histórico
          </button>
        </div>
      </form>
    </div>
  );
}
