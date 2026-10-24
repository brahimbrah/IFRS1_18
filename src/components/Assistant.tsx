import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../lib/store';
import type { ChatMessage } from '../lib/types';
import { Banner, Spinner } from './ui';

export default function Assistant() {
  const { current, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ ready: boolean; reason?: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !current) return;
    (async () => {
      try {
        const res = await api.get<{ messages: ChatMessage[]; ai: any }>(`/dossiers/${current.id}/chat`);
        setMessages(res.messages);
        setAiStatus(res.ai);
      } catch {
        /* ignore */
      }
    })();
  }, [open, current]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send() {
    if (!current || !question.trim()) return;
    const q = question.trim();
    setQuestion('');
    setMessages((m) => [
      ...m,
      { id: 'tmp-' + Date.now(), dossier_id: current.id, role: 'user', content: q, refs_json: '[]', provider: '', created_at: new Date().toISOString() },
    ]);
    setLoading(true);
    try {
      const res = await api.post<{ answer: string; mode: string; refs: any[]; message: ChatMessage }>(`/dossiers/${current.id}/chat`, { question: q });
      setMessages((m) => [
        ...m.filter((x) => !x.id.startsWith('tmp-')),
        { ...res.message, role: 'user' as const, id: 'u-' + res.message.id, content: q },
        res.message,
      ]);
    } catch (e: any) {
      notify(e?.message || 'Réponse impossible.', 'error');
      setMessages((m) => m.filter((x) => !x.id.startsWith('tmp-')));
    } finally {
      setLoading(false);
    }
  }

  async function clearChat() {
    if (!current) return;
    await api.del(`/dossiers/${current.id}/chat`).catch(() => undefined);
    setMessages([]);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-navy-800 px-4 py-3 text-sm font-medium text-white shadow-panel hover:bg-navy-900 no-print"
        >
          <Sparkles className="h-4 w-4 text-teal-300" />
          Assistant IFRS
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[32rem] w-[26rem] max-w-[calc(100vw-2.5rem)] flex-col card shadow-panel animate-fade no-print">
          <div className="flex items-center gap-2 border-b border-navy-100 px-4 py-3">
            <Bot className="h-5 w-5 text-teal-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy-900">Assistant IFRS</p>
              <p className="text-[11px] text-navy-500 truncate">
                {aiStatus?.ready ? 'Modèle IA connecté' : 'Moteur déterministe (IA non configurée)'}
              </p>
            </div>
            <button className="text-navy-400 hover:text-navy-600" onClick={clearChat} title="Effacer la conversation">
              <Trash2 className="h-4 w-4" />
            </button>
            <button className="text-navy-400 hover:text-navy-600" onClick={() => setOpen(false)} aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-navy-50/40">
            {!current && <Banner kind="warn">Sélectionnez un dossier pour interroger l’assistant sur vos données.</Banner>}
            {current && messages.length === 0 && (
              <div className="text-sm text-navy-600 space-y-2">
                <p className="font-medium text-navy-800">Posez une question sur le dossier « {current.name} ».</p>
                <p className="text-xs">L’assistant explique les divergences CGNC ↔ IFRS et les retraitements calculés par le moteur. Il ne produit jamais de montant de lui-même : les chiffres proviennent exclusivement du moteur déterministe.</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Quels retraitements sont requis ?', 'Pourquoi la durée d’utilité IAS 16 diffère-t-elle ?', 'Explique l’impôt différé IAS 12.'].map((s) => (
                    <button key={s} className="chip border border-navy-200 bg-white text-navy-700 hover:bg-navy-100" onClick={() => setQuestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-navy-700 text-white' : 'bg-white border border-navy-100 text-navy-800'}`}>
                  {m.content}
                  {m.role === 'assistant' && m.provider && <p className="mt-1.5 text-[10px] text-navy-400">Source : {m.provider}</p>}
                </div>
              </div>
            ))}
            {loading && <Spinner label="Analyse en cours…" />}
            <div ref={endRef} />
          </div>

          <div className="border-t border-navy-100 p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                className="input resize-none h-11 max-h-28"
                placeholder={current ? 'Votre question…' : 'Sélectionnez un dossier'}
                value={question}
                disabled={!current}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button className="btn-accent h-11 px-3" onClick={send} disabled={!current || loading || !question.trim()}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
