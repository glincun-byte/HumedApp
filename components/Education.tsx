
import React, { useEffect, useState, useRef } from 'react';
import {
  Bird,
  Sprout,
  Bug,
  Droplets,
  CalendarDays,
  Clock,
  MapPin,
  PlusCircle,
  Image as ImageIcon,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { useNetworkStatus } from './useNetworkStatus';

interface EducationEvent {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  eventDate: string;
  eventTime: string | null;
  publishedAt: string;
}

type TopicId = 'aves' | 'plantas' | 'anfibios' | 'insectos';

const Education: React.FC = () => {
  const { user } = useAuth();
  const isOnline = useNetworkStatus();
  const { isSupported, permission, requestPermission, notify } = useNotifications();
  const [isAdmin, setIsAdmin] = useState(false);
  const [events, setEvents] = useState<EducationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicId | null>(null);
  const notifiedEventIdsRef = useRef<Set<string>>(new Set());

  const categories: {
    id: TopicId;
    title: string;
    icon: React.ComponentType<any>;
    summary: string;
  }[] =
    [
      {
        id: 'aves',
        title: 'Aves',
        icon: Bird,
        summary: 'Más de 30 especies visitan y habitan el humedal.',
      },
      {
        id: 'plantas',
        title: 'Plantas',
        icon: Sprout,
        summary: 'Plantas acuáticas y árboles nativos que mantienen vivo el humedal.',
      },
      {
        id: 'anfibios',
        title: 'Anfibios',
        icon: Droplets,
        summary: 'Indicadores de salud ambiental como la rana sabanera.',
      },
      {
        id: 'insectos',
        title: 'Insectos',
        icon: Bug,
        summary: 'Polinizadores, mariposas y escarabajos que sostienen la cadena alimenticia.',
      },
    ];

  useEffect(() => {
    const loadRole = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!error && data?.role === 'admin') {
        setIsAdmin(true);
      }
    };
    loadRole().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        if (!navigator.onLine) {
          const cached = window.localStorage.getItem('ecovigia_education_events');
          if (cached) {
            setEvents(JSON.parse(cached));
          }
          setLoadingEvents(false);
          return;
        }

        const { data, error } = await supabase
          .from('education_events')
          .select('id, title, description, image_url, event_date, event_time, published_at')
          .order('event_date', { ascending: true });

        if (!error && data) {
          const mapped: EducationEvent[] = data.map((row: any) => ({
            id: row.id as string,
            title: row.title,
            description: row.description,
            imageUrl: row.image_url || null,
            eventDate: row.event_date,
            eventTime: row.event_time || null,
            publishedAt: row.published_at,
          }));
          setEvents(mapped);
          notifiedEventIdsRef.current = new Set(mapped.map(ev => ev.id));
          try {
            window.localStorage.setItem('ecovigia_education_events', JSON.stringify(mapped));
          } catch {
            // ignore storage errors
          }
        }
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents().catch(() => setLoadingEvents(false));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('education-events-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'education_events' },
        async payload => {
          const row = payload.new as any;
          if (!row?.id) return;
          if (notifiedEventIdsRef.current.has(row.id)) return;
          notifiedEventIdsRef.current.add(row.id);

          const newEvent: EducationEvent = {
            id: row.id as string,
            title: row.title,
            description: row.description,
            imageUrl: row.image_url || null,
            eventDate: row.event_date,
            eventTime: row.event_time || null,
            publishedAt: row.published_at,
          };

          setEvents(prev => {
            const withoutOld = prev.filter(ev => ev.id !== newEvent.id);
            return [...withoutOld, newEvent].sort(
              (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
            );
          });

          const perm = await requestPermission();
          if (perm === 'granted') {
            notify('Nuevo evento de educación ambiental', {
              body: `${newEvent.title} · ${newEvent.eventDate}${newEvent.eventTime ? ` ${newEvent.eventTime.slice(0, 5)}` : ''}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [notify, requestPermission]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user || !title.trim() || !description.trim() || !eventDate || !eventTime) return;
    setSavingEvent(true);

    let data: any = null;
    let error: any = null;

    if (editingEventId) {
      const response = await supabase
        .from('education_events')
        .update({
          title: title.trim(),
          description: description.trim(),
          image_url: imagePreview,
          event_date: eventDate,
          event_time: eventTime,
        })
        .eq('id', editingEventId)
        .select('id, title, description, image_url, event_date, event_time, published_at')
        .single();
      data = response.data;
      error = response.error;
    } else {
      const response = await supabase
        .from('education_events')
        .insert({
          title: title.trim(),
          description: description.trim(),
          image_url: imagePreview,
          event_date: eventDate,
          event_time: eventTime,
          created_by: user.id,
        })
        .select('id, title, description, image_url, event_date, event_time, published_at')
        .single();
      data = response.data;
      error = response.error;
    }

    if (!error && data) {
      const isNewEvent = !editingEventId;
      const newEvent: EducationEvent = {
        id: data.id,
        title: data.title,
        description: data.description,
        imageUrl: data.image_url || null,
        eventDate: data.event_date,
        eventTime: data.event_time || null,
        publishedAt: data.published_at,
      };
      setEvents(prev => {
        const withoutOld = prev.filter(ev => ev.id !== newEvent.id);
        return [...withoutOld, newEvent].sort(
          (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
        );
      });
      setTitle('');
      setDescription('');
      setEventDate('');
      setEventTime('');
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setEditingEventId(null);

      if (isNewEvent) {
        notifiedEventIdsRef.current.add(newEvent.id);
      }
    } else if (error) {
      alert(`No se pudo guardar el evento: ${error.message ?? 'Error desconocido'}`);
    }

    setSavingEvent(false);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = events.filter(ev => {
    const d = new Date(ev.eventDate);
    d.setHours(0, 0, 0, 0);
    return d >= today;
  });

  const pastEvents = events
    .filter(ev => {
      const d = new Date(ev.eventDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    })
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
    .slice(0, 5);

  return (
    <div className="p-4 animate-fadeIn pb-24 text-black">
      <h2 className="text-2xl font-bold text-black mb-4">Aprende y Protege</h2>
      
      {!isOnline && (
        <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
          Estás sin conexión. Puedes consultar esta información educativa y los eventos que ya se
          hayan cargado, pero no se actualizarán hasta que vuelvas a conectarte.
        </p>
      )}

      {isSupported && (
        <div className="mb-4 text-[11px] eco-forest-card rounded-2xl px-3 py-2 flex items-center justify-between gap-3">
          <span>
            Recibe recordatorios de eventos ambientales en tu dispositivo.
          </span>
          <button
            type="button"
            onClick={async () => {
              const result = await requestPermission();
              if (result === 'granted' && upcomingEvents[0]) {
                const next = upcomingEvents[0];
                notify('Próximo evento ambiental', {
                  body: `${next.title} - ${next.eventDate} ${next.eventTime ?? ''}`.trim(),
                });
              }
            }}
            className="px-3 py-1 rounded-full eco-forest-btn text-[10px] font-semibold disabled:opacity-60"
            disabled={permission === 'granted'}
          >
            {permission === 'granted' ? 'Notificaciones activas' : 'Activar'}
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        {categories.map(cat => {
          const TopicIcon = cat.icon;
          return (
          <button
            key={cat.id}
            onClick={() => setSelectedTopic(cat.id)}
            className="p-4 rounded-2xl eco-forest-card flex flex-col items-center active:scale-[0.98] transition-transform"
          >
            <div className="w-11 h-11 rounded-2xl mb-2 flex items-center justify-center bg-white/18 text-emerald-50">
              <TopicIcon size={22} strokeWidth={2.2} />
            </div>
            <span className="font-bold text-gray-800 text-sm">{cat.title}</span>
            <span className="text-[10px] text-gray-500 mt-1 text-center">
              {cat.summary}
            </span>
          </button>
          );
        })}
      </div>

      <section className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarDays size={20} className="text-white" />
            Eventos de Educación Ambiental
          </h3>
        </div>

        {isAdmin && (
          <form
            onSubmit={handleCreateEvent}
            className="mb-6 eco-forest-card rounded-3xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <PlusCircle size={18} className="text-emerald-600" />
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Crear nuevo evento (solo administradores)
              </p>
            </div>
            <input
              type="text"
              placeholder="Título del evento"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              style={{ color: '#000000' }}
              required
            />
            <textarea
              placeholder="Descripción del evento"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              style={{ color: '#000000' }}
              rows={3}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-white mb-1">
                  Fecha del evento
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full min-h-[44px] p-2.5 rounded-xl border border-gray-200 text-sm bg-white text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                  style={{ color: '#000000' }}
                  required
                />
                {!eventDate && (
                  <p className="text-[10px] text-white mt-1">
                    Selecciona fecha
                  </p>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-white mb-1">
                  Hora del evento
                </label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={e => setEventTime(e.target.value)}
                  className="w-full min-h-[44px] p-2.5 rounded-xl border border-gray-200 text-sm bg-white text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                  style={{ color: '#000000' }}
                  required
                />
                {!eventTime && (
                  <p className="text-[10px] text-white mt-1">
                    Selecciona hora
                  </p>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-white mb-1">
                  Imagen (opcional)
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-emerald-100/40 text-xs text-white flex items-center justify-center gap-2 eco-forest-btn"
                >
                  <ImageIcon size={16} />
                  {imagePreview ? 'Cambiar imagen' : 'Subir imagen'}
                </button>
                {!imagePreview && (
                  <p className="text-[10px] text-white mt-1">
                    Sin imagen seleccionada
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>
            {imagePreview && (
              <div className="mt-2 rounded-2xl overflow-hidden border border-emerald-50">
                <img
                  src={imagePreview}
                  alt="Previsualización"
                  className="w-full h-32 object-cover"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={savingEvent}
              className="w-full mt-2 py-2.5 eco-forest-btn rounded-xl text-xs font-semibold disabled:opacity-60"
            >
              {savingEvent
                ? 'Guardando...'
                : editingEventId
                ? 'Guardar cambios'
                : 'Publicar evento'}
            </button>
          </form>
        )}

        {loadingEvents ? (
          <p className="text-xs text-gray-500">Cargando eventos...</p>
        ) : upcomingEvents.length === 0 && pastEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center eco-forest-card rounded-3xl p-6 text-center text-emerald-50">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3 relative">
              <Bird size={28} className="text-emerald-500" />
              <span className="absolute -right-1 -top-1 bg-white border border-emerald-200 rounded-full w-5 h-5 flex items-center justify-center text-[10px] text-emerald-600 font-bold">
                ?
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-700">No hay eventos publicados aun</p>
          </div>
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <div className="mb-4">
                <h4 className="text-md font-bold text-white uppercase mb-2 flex items-center gap-1">
                  <Clock size={12} />
                  Próximos eventos
                </h4>
                <div className="flex flex-col gap-3">
                  {upcomingEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="eco-forest-card rounded-3xl p-4 flex gap-3"
                    >
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-emerald-50 flex items-center justify-center shrink-0">
                        {ev.imageUrl ? (
                          <img
                            src={ev.imageUrl}
                            alt={ev.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Bird size={28} className="text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1 flex items-center gap-1">
                          Evento •{' '}
                          {new Date(ev.eventDate).toLocaleDateString(undefined, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {ev.eventTime && (
                            <>
                              <span>•</span>
                              <span>
                                {ev.eventTime.slice(0, 5)}
                              </span>
                            </>
                          )}
                        </p>
                        <h5 className="text-sm font-bold text-gray-800">{ev.title}</h5>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {ev.description}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Publicado el{' '}
                          {new Date(ev.publishedAt).toLocaleDateString(undefined, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex flex-col gap-2 items-end ml-2">
                          <button
                            onClick={() => {
                              setEditingEventId(ev.id);
                              setTitle(ev.title);
                              setDescription(ev.description);
                              setEventDate(ev.eventDate);
                              setEventTime(ev.eventTime || '');
                              setImagePreview(ev.imageUrl);
                            }}
                            className="text-[10px] text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                          >
                            <Edit2 size={12} />
                            Editar
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  '¿Seguro que deseas eliminar este evento? Esta acción no se puede deshacer.'
                                )
                              ) {
                                return;
                              }
                              const { error } = await supabase
                                .from('education_events')
                                .delete()
                                .eq('id', ev.id);
                              if (error) {
                                alert('No se pudo eliminar el evento.');
                              } else {
                                setEvents(prev => prev.filter(e => e.id !== ev.id));
                                if (editingEventId === ev.id) {
                                  setEditingEventId(null);
                                  setTitle('');
                                  setDescription('');
                                  setEventDate('');
                                  setEventTime('');
                                  setImagePreview(null);
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }
                              }
                            }}
                            className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pastEvents.length > 0 && (
              <div className="mt-4">
                <h4 className="text-md font-semibold text-white uppercase mb-2 flex items-center gap-1">
                  <CalendarDays size={12} />
                  Eventos pasados
                </h4>
                <div className="flex flex-col gap-2">
                  {pastEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-gray-400"
                    >
                      <p className="text-[10px] uppercase font-semibold mb-1">
                        {new Date(ev.eventDate).toLocaleDateString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {ev.eventTime && ` • ${ev.eventTime.slice(0, 5)}`}
                      </p>
                      <p className="text-xs font-semibold">{ev.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {selectedTopic && (
        <div
          className="fixed inset-0 z-[2300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedTopic(null)}
        >
          <div
            className="eco-card rounded-3xl max-w-md w-full p-5 max-h-[88dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedTopic(null)}
              className="absolute top-4 right-5 text-gray-400 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            {selectedTopic === 'aves' && (
              <>
                <h3 className="text-xl font-bold text-emerald-900 mb-2">
                  🐦 Aves del Humedal
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Aunque es un humedal pequeño, en Techo se han registrado más de 30 especies
                  de aves que lo usan para alimentarse, descansar o reproducirse.
                </p>
                <div className="space-y-3 text-xs text-gray-700">
                  <div>
                    <p className="font-semibold">🟡 La monjita cabeciamarilla</p>
                    <p>Un ave muy llamativa por su cabeza amarilla brillante.</p>
                    <p>Es una especie típica de los humedales de la Sabana de Bogotá.</p>
                    <p className="mt-1 italic">
                      Curiosidad: 👉 Los machos suelen cantar desde los juncos para defender su
                      territorio.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🐦 El copetón: el “vecino” del humedal</p>
                    <p>Es uno de los pájaros más comunes en Bogotá.</p>
                    <p className="mt-1 italic">
                      Dato curioso: 👉 Su nombre viene del pequeño copete de plumas en la cabeza.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🦅 El gavilán bailarín</p>
                    <p>Es un ave rapaz que puede verse cerca del humedal.</p>
                    <p className="mt-1 italic">
                      Dato curioso: 👉 Recibe su nombre porque cuando caza se mueve rápidamente
                      como si estuviera bailando en el aire.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🦉 El búho carablanca</p>
                    <p>Una de las aves nocturnas del humedal.</p>
                    <p className="mt-1 italic">
                      Curiosidad: 👉 Su rostro blanco refleja la luz de la luna y le ayuda a
                      asustar a depredadores o presas.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🌎 Aves migratorias</p>
                    <p>
                      Algunas aves que llegan al humedal viajan miles de kilómetros desde
                      Norteamérica para pasar el invierno en Colombia.
                    </p>
                  </div>
                </div>
              </>
            )}

            {selectedTopic === 'plantas' && (
              <>
                <h3 className="text-xl font-bold text-emerald-900 mb-2">
                  🌿 Plantas del Humedal
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Las plantas acuáticas y los árboles nativos mantienen vivo el humedal y
                  ofrecen alimento y refugio a muchas especies.
                </p>
                <div className="space-y-3 text-xs text-gray-700">
                  <div>
                    <p className="font-semibold">🌱 La lenteja de agua</p>
                    <p>Es una de las plantas acuáticas más pequeñas del mundo.</p>
                    <p className="mt-1 italic">
                      Dato curioso: 👉 ¡Puede duplicar su tamaño en pocos días! Por eso cubre
                      rápidamente la superficie del agua.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🌾 La enea</p>
                    <p>Planta alta típica de los humedales.</p>
                    <p>Funciona como filtro natural del agua, atrapando contaminantes.</p>
                    <p className="mt-1">
                      También sirve de refugio para aves y anfibios, que se esconden entre sus
                      tallos.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🍃 Helecho de agua</p>
                    <p>Es una planta flotante muy común en humedales.</p>
                    <p className="mt-1 italic">
                      Dato curioso: 👉 Puede ayudar a absorber nutrientes y contribuir a limpiar
                      el agua.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🌳 Árboles nativos del humedal</p>
                    <p>En procesos de restauración se han sembrado especies como:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>mano de oso</li>
                      <li>laurel</li>
                      <li>duraznillo</li>
                      <li>siete cueros</li>
                    </ul>
                    <p className="mt-1">
                      Estas plantas ayudan a recuperar el ecosistema y a conectar el humedal con
                      el paisaje de la ciudad.
                    </p>
                  </div>
                </div>
              </>
            )}

            {selectedTopic === 'anfibios' && (
              <>
                <h3 className="text-xl font-bold text-emerald-900 mb-2">
                  🐸 Anfibios del Humedal
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Los anfibios son muy sensibles a la contaminación, por eso su presencia nos
                  habla de la salud del ecosistema.
                </p>
                <div className="space-y-3 text-xs text-gray-700">
                  <div>
                    <p className="font-semibold">🐸 La rana sabanera</p>
                    <p>Es el anfibio más representativo del humedal de Techo.</p>
                    <p className="mt-1 italic">
                      Dato curioso: 👉 Su canto se escucha más fuerte después de la lluvia.
                    </p>
                    <p className="mt-1">
                      Nombre científico: <span className="italic">Dendropsophus labialis</span>.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🌧️ Indicadores de salud ambiental</p>
                    <p>
                      Los anfibios son muy sensibles a los cambios en la calidad del agua y del
                      aire.
                    </p>
                    <p className="mt-1 italic">
                      Curiosidad: 👉 Si hay ranas en un humedal, generalmente significa que el
                      ecosistema aún tiene buena calidad ambiental.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🌙 Cantan para encontrar pareja</p>
                    <p>
                      Los machos cantan durante la noche para atraer hembras y defender su
                      territorio.
                    </p>
                    <p className="mt-1 italic">
                      Dato curioso: 👉 Cada especie tiene un canto diferente, como si fuera su
                      propia “firma sonora”.
                    </p>
                  </div>
                </div>
              </>
            )}

            {selectedTopic === 'insectos' && (
              <>
                <h3 className="text-xl font-bold text-emerald-900 mb-2">
                  🐝 Insectos del Humedal
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Los insectos son los “trabajadores silenciosos” del humedal: polinizan,
                  descomponen materia orgánica y sirven de alimento a otras especies.
                </p>
                <div className="space-y-3 text-xs text-gray-700">
                  <div>
                    <p className="font-semibold">🐝 Abejas y polinizadores</p>
                    <p>Muchas especies de abejas visitan las flores del humedal.</p>
                    <p className="mt-1 italic">
                      Dato curioso: 👉 Son responsables de polinizar gran parte de las plantas
                      que mantienen el ecosistema.
                    </p>
                    <p className="mt-1">
                      Algunos proyectos de restauración buscan atraer más abejas y colibríes
                      sembrando flores nativas.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🦋 Mariposas del humedal</p>
                    <p>Las mariposas dependen de plantas específicas para vivir.</p>
                    <p className="mt-1 italic">
                      Curiosidad: 👉 Algunas especies solo ponen huevos en una planta
                      determinada.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🦟 Los mosquitos también cumplen una función</p>
                    <p>Aunque muchas veces nos molestan, tienen un papel importante.</p>
                    <p className="mt-1 italic">
                      Dato curioso: 👉 Son alimento para ranas, aves y murciélagos.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">🐞 Escarabajos acuáticos</p>
                    <p>Viven en el agua del humedal y ayudan a descomponer materia orgánica.</p>
                    <p className="mt-1 italic">
                      Curiosidad: 👉 Algunos pueden respirar atrapando burbujas de aire bajo sus
                      alas.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Education;
