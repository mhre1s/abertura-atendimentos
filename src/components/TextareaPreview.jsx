import React, { useState } from 'react';
import { 
  FileText, 
  Copy, 
  Check, 
  MessageSquare, 
  Download 
} from 'lucide-react';

export default function TextareaPreview({
  generatedText,
  formData,
  onCopy,
  onShowToast
}) {
  const [copiedRecently, setCopiedRecently] = useState(false);

  const handleCopyClick = async () => {
    const success = await onCopy(generatedText);
    if (success) {
      setCopiedRecently(true);
      setTimeout(() => setCopiedRecently(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    if (!generatedText) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(generatedText)}`;
    window.open(url, '_blank');
  };

  const handleDownloadTxt = () => {
    if (!generatedText) return;
    const tipo = (formData.tipo || 'ATENDIMENTO').replace(/#/g, '');
    const contrato = formData.contrato || 'SCM';
    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Atendimento_${tipo}_${contrato}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Arquivo .TXT baixado com sucesso!');
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-800">Texto Gerado</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
            {generatedText.length} caracteres
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Tempo Real
          </span>
        </div>
      </div>

      {/* Generated Textarea */}
      <div className="relative mb-4">
        <textarea
          rows={7}
          readOnly
          value={generatedText}
          onClick={(e) => e.target.select()}
          className="w-full font-mono text-sm leading-relaxed p-4 bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none select-all transition-all resize-y"
          placeholder="O texto formatado aparecerá aqui..."
        />
        
        {/* Floating Quick Copy Button */}
        <button
          type="button"
          onClick={handleCopyClick}
          title="Copiar texto rapidamente"
          className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all shadow-md cursor-pointer"
        >
          {copiedRecently ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleCopyClick}
          className={`w-full py-3.5 px-4 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer transform active:scale-[0.99] ${
            copiedRecently
              ? 'bg-emerald-600 shadow-emerald-500/25 copied-pulse'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
          }`}
        >
          {copiedRecently ? (
            <>
              <Check className="w-5 h-5" />
              <span>Copiado com Sucesso!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              <span>Copiar Texto Formatado (Ctrl + Enter)</span>
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl border border-emerald-200 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>Compartilhar WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Baixar .TXT</span>
          </button>
        </div>
      </div>
    </div>
  );
}
