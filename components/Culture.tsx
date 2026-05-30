
import React, { useState } from 'react';
import {
  History,
  Mic,
  Map as MapIcon,
  ChevronRight,
  Feather,
  Home,
  Tractor,
  Building2,
  Users,
  ShieldCheck,
  Sprout,
  X,
} from 'lucide-react';
import { useLanguage } from './LanguageContext';

interface TimelineEvent {
  id: string;
  period: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  sources: string[];
}

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'muisca',
    period: 'Antes del siglo XVI',
    title: 'Territorio Muisca',
    description:
      'El territorio del Humedal de Techo hacía parte de la red de lagunas y humedales de la Sabana de Bogotá habitada por el pueblo muisca. Estaba asociado al cacique Techovita y era un espacio sagrado para la pesca, la agricultura y la vida espiritual.',
    icon: Feather,
    sources: ['Humedal de Techo – Wikipedia', 'Jardín Botánico de Bogotá'],
  },
  {
    id: 'hacienda',
    period: 'Siglos XVII – XIX',
    title: 'Hacienda Techo y periodo colonial',
    description:
      'Durante la Colonia el humedal pasó a formar parte de grandes haciendas agrícolas. Fue parte de la Hacienda Techo, administrada por órdenes religiosas, y seguía conectado al sistema hídrico de la Sabana y al río Bogotá.',
    icon: Home,
    sources: ['Jardín Botánico de Bogotá', 'Archivo histórico de Bogotá'],
  },
  {
    id: 'rural-transform',
    period: '1930 – 1970',
    title: 'Transformación del paisaje rural',
    description:
      'En el siglo XX inició la urbanización progresiva del suroccidente de Bogotá. La parcelación de haciendas, nuevas vías e infraestructura redujeron el tamaño de los humedales y fragmentaron los ecosistemas naturales.',
    icon: Tractor,
    sources: ['Fundación Humedales Bogotá', 'Archivo urbano de Bogotá'],
  },
  {
    id: 'urbanizacion',
    period: 'Década de 1990',
    title: 'Urbanización y reducción del humedal',
    description:
      'El crecimiento urbano acelerado de los años noventa afectó gravemente al humedal. Parte del terreno se destinó a proyectos de vivienda, como la urbanización Lagos de Castilla, reduciendo significativamente el área del ecosistema.',
    icon: Building2,
    sources: ['Humedal de Techo – Wikipedia', 'Fundación Humedales Bogotá'],
  },
  {
    id: 'organizacion',
    period: '1998',
    title: 'Organización comunitaria para su protección',
    description:
      'Habitantes del sector comenzaron a organizarse para evitar la desaparición del humedal. Surgieron organizaciones ambientales y procesos de participación ciudadana para defender el ecosistema y promover su conservación.',
    icon: Users,
    sources: ['Fundación Humedales Bogotá', 'Archivo ambiental de Bogotá'],
  },
  {
    id: 'declaratoria',
    period: '2003 – 2004',
    title: 'Declaratoria como área protegida',
    description:
      'El humedal fue reconocido oficialmente como área de importancia ambiental y declarado Parque Ecológico Distrital de Humedal. Esto permitió iniciar programas de manejo, restauración ecológica y educación ambiental.',
    icon: ShieldCheck,
    sources: ['Secretaría Distrital de Ambiente de Bogotá'],
  },
  {
    id: 'restauracion',
    period: '2010 – Actualidad',
    title: 'Restauración ecológica y educación ambiental',
    description:
      'Hoy se desarrollan proyectos de restauración ecológica, recuperación de flora nativa y actividades educativas con la comunidad. El humedal es un espacio clave para la biodiversidad urbana y la memoria ambiental de la ciudad.',
    icon: Sprout,
    sources: ['Secretaría Distrital de Ambiente', 'Fundación Humedales Bogotá'],
  },
];

const Culture: React.FC = () => {
  const { lang } = useLanguage();
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  return (
    <div className="p-4 animate-fadeIn pb-24 text-black">
      <h2 className="text-2xl font-bold text-black mb-4">
        {lang === 'en' ? 'Culture and Memory' : 'Cultura y Memoria'}
      </h2>
      
      <p className="text-sm text-black eco-card-soft p-4 rounded-2xl mb-6 leading-relaxed">
        {lang === 'en'
          ? 'The Techo Wetland is a sacred place full of history. Here we remember the stories of our ancestors and the evolution of the ecosystem.'
          : 'El Humedal de Techo es un espacio sagrado y cargado de historia. Aquí recuperamos las historias de nuestros ancestros y la evolución del ecosistema.'}
      </p>

      <section className="mb-8">
        <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
          <History size={20} />
          {lang === 'en' ? 'Timeline' : 'Línea del Tiempo'}
        </h3>
        <div className="flex flex-col gap-3">
          {TIMELINE_EVENTS.map(event => {
            const Icon = event.icon;
            return (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="w-full text-left eco-card-soft p-3 rounded-2xl flex gap-3 items-start active:scale-[0.99] transition-transform"
              >
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-tight">
                    {event.period}
                  </p>
                  <h4 className="font-bold text-sm text-gray-800">{event.title}</h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {event.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {lang === 'en' ? 'Tap to expand' : 'Toca para ampliar'}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/85" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selectedEvent && (
        <div
          className="fixed inset-0 z-[2500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="eco-card rounded-3xl max-w-md w-full p-5 relative max-h-[88dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
                {(() => {
                  const Icon = selectedEvent.icon;
                  return <Icon size={24} />;
                })()}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-tight">
                  {selectedEvent.period}
                </p>
                <h3 className="text-lg font-bold text-emerald-900">
                  {selectedEvent.title}
                </h3>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {selectedEvent.description}
            </p>
            {selectedEvent.sources.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  {lang === 'en' ? 'Sources' : 'Fuentes'}
                </p>
                <ul className="list-disc list-inside text-xs text-gray-500 space-y-1">
                  {selectedEvent.sources.map((src, idx) => (
                    <li key={idx}>{src}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Culture;
