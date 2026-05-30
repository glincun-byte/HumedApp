
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { getGeminiResponse } from '../services/geminiService';
import { useLanguage } from './LanguageContext';

const Chatbot: React.FC = () => {
  const { lang } = useLanguage();
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    {
      role: 'bot',
      text:
        lang === 'en'
          ? 'Hi! I am EcoBot. What would you like to know about the Techo Wetland today?'
          : '¡Hola! Soy EcoBot. ¿Qué te gustaría saber sobre el Humedal de Techo hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      let response = await getGeminiResponse(userText, lang === 'en' ? 'en' : 'es');

      // Si el servicio de IA no está disponible o la respuesta viene vacía,
      // usamos una respuesta local sencilla para que el chatbot siempre funcione.
      if (
        !response ||
        response.includes('no disponible porque el servicio de IA no está configurado') ||
        response.includes('unavailable because the AI service is not configured')
      ) {
        response =
          lang === 'en'
            ? `ECOBOT – ANSWER SUMMARY

• I am not connected to the AI service right now, but I can give you general guidance.
• Remember that the Techo Wetland is an ecosystem with birds, plants, amphibians and insects that needs our care.
• You can use the app modules (Monitoring, Education, Community and Memory) to explore more information and report what you see.

Remember: every report and question you make helps to protect the wetland.`
            : `ECOBOT – RESUMEN DE RESPUESTA

• En este momento no estoy conectado al servicio de IA, pero puedo darte una orientación general.
• Recuerda que el Humedal de Techo es un ecosistema con aves, plantas, anfibios e insectos que necesita nuestro cuidado.
• Puedes usar los módulos de la app (Monitoreo, Educación, Comunidad y Memoria) para explorar más información y reportar lo que observas.

Recuerda: cada reporte y cada pregunta que haces ayuda a proteger el humedal.`;
      }

      setMessages(prev => [...prev, { role: 'bot', text: response }]);
    } catch (error) {
      const fallback =
        lang === 'en'
          ? `ECOBOT – ANSWER SUMMARY

• I could not contact the AI service, but here is a general tip.
• The Techo Wetland is a fragile ecosystem. Avoid leaving trash, respect the fauna and follow the recommended trails.

Remember: small actions from citizens help keep the wetland alive.`
          : `ECOBOT – RESUMEN DE RESPUESTA

• No pude contactar el servicio de IA, pero aquí tienes una recomendación general.
• El Humedal de Techo es un ecosistema frágil: evita dejar basura, respeta la fauna y sigue los senderos recomendados.

Recuerda: las pequeñas acciones de la ciudadanía ayudan a mantener vivo el humedal.`;

      setMessages(prev => [...prev, { role: 'bot', text: fallback }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-[calc(100dvh-220px)] animate-fadeIn px-3 pb-2">
      <div className="eco-card rounded-[22px] p-4 text-emerald-950 shrink-0 mb-3">
        <h2 className="text-lg font-extrabold">
          {lang === 'en' ? 'EcoBot Assistant' : 'Asistente EcoBot'}
        </h2>
        <p className="text-xs text-slate-600">
          {lang === 'en'
            ? 'Powered by Proyección Social Uniagustiniana'
            : 'Impulsado por Proyección Social Uniagustiniana'}
        </p>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 pb-[220px] space-y-4 no-scrollbar"
      >
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-emerald-100/95 text-emerald-700' : 'bg-emerald-700 text-white'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-emerald-700/95 text-white rounded-tr-none shadow-[0_8px_20px_rgba(6,78,59,0.28)]'
                  : 'eco-card text-gray-800 rounded-tl-none'
              } whitespace-pre-wrap leading-relaxed`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-2 items-center eco-card-soft p-3 rounded-2xl text-emerald-600 text-sm">
              <Loader2 size={16} className="animate-spin" />
              <span>
                {lang === 'en' ? 'EcoBot is thinking...' : 'EcoBot está pensando...'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-md px-3 z-[2550]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
      >
        <div className="p-3 eco-card rounded-[22px] flex gap-2">
          <input 
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={
              lang === 'en' ? 'Ask about flora, fauna...' : 'Pregunta sobre flora, fauna...'
            }
            className="flex-1 bg-white/85 border border-white px-4 py-2 rounded-full text-base outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-emerald-700 text-white p-2.5 rounded-full disabled:opacity-50 shadow-md"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
