
import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Edit2, ChevronLeft, Trash2, ChevronRight } from 'lucide-react';
import { useParticipationViewModel } from '../useParticipationViewModel';
import { useAuth } from './AuthContext';
import { useNetworkStatus } from './useNetworkStatus';
import { useLanguage } from './LanguageContext';

const Participation: React.FC = () => {
  const vm = useParticipationViewModel();
  const { user } = useAuth();
  const isOnline = useNetworkStatus();
  const { lang } = useLanguage();
  const [newQuestion, setNewQuestion] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [commentsPage, setCommentsPage] = useState(0);
  const PAGE_SIZE = 5;

  useEffect(() => {
    setCommentsPage(0);
  }, [vm.sortMode]);

  const pagedPosts = useMemo(
    () => vm.posts.slice(commentsPage * PAGE_SIZE, commentsPage * PAGE_SIZE + PAGE_SIZE),
    [vm.posts, commentsPage]
  );
  const totalPages = Math.max(1, Math.ceil(vm.posts.length / PAGE_SIZE));

  useEffect(() => {
    if (commentsPage > totalPages - 1) {
      setCommentsPage(Math.max(0, totalPages - 1));
    }
  }, [commentsPage, totalPages]);

  const renderFeed = () => (
    <div className="animate-fadeIn text-black">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-black">
          {lang === 'en' ? 'Community' : 'Comunidad'}
        </h2>
        <button onClick={() => vm.setView('profile')} className="flex items-center gap-2 eco-forest-card p-1.5 pr-3 rounded-full">
          <img src={vm.profile.avatar} className="w-8 h-8 rounded-full" alt="profile"/>
          <span className="text-xs font-bold">{vm.profile.name}</span>
        </button>
      </div>

      <div className="mb-4">
        {!isOnline && (
          <p className="mb-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
            {lang === 'en'
              ? 'You are offline. You can only read queries that have already been loaded; posting, editing or liking requires a connection.'
              : 'Estás sin conexión. Solo puedes leer las consultas que ya se hayan cargado; publicar, editar o dar like requiere conexión.'}
          </p>
        )}
        <p className="text-xs text-black mb-2">
          {lang === 'en'
            ? 'Share questions or reflections about the wetland and see the most recent or highlighted ones by the community.'
            : 'Comparte consultas o reflexiones sobre el humedal y ve las más recientes o destacadas por la comunidad.'}
        </p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => vm.setSortMode('latest')}
            className={`flex-1 py-1.5 rounded-full text-[11px] font-semibold ${
              vm.sortMode === 'latest'
                ? 'eco-forest-btn text-white'
                : 'eco-forest-btn text-emerald-50/85'
            }`}
          >
            {lang === 'en' ? 'Latest' : 'Últimos'}
          </button>
          <button
            onClick={() => vm.setSortMode('top')}
            className={`flex-1 py-1.5 rounded-full text-[11px] font-semibold ${
              vm.sortMode === 'top'
                ? 'eco-forest-btn text-white'
                : 'eco-forest-btn text-emerald-50/85'
            }`}
          >
            {lang === 'en' ? 'Top' : 'Destacados'}
          </button>
        </div>

        <div className="eco-forest-card p-3 rounded-2xl mb-4">
          <textarea
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            rows={3}
            className="w-full text-sm text-emerald-50 placeholder:text-emerald-100/80 border-none outline-none resize-none bg-transparent"
            placeholder={lang==='en'? "Write your question or contribution about the Techo Wetland here..." : "Escribe tu consulta o contribución sobre el Humedal"} 
          />
          <div className="flex justify-end mt-2">
            {editingPostId ? (
              <>
                <button
                  disabled={!newQuestion.trim() || !user}
                  onClick={() => {
                    if (!user || !newQuestion.trim() || !editingPostId) return;
                    vm.updatePost(editingPostId, newQuestion.trim());
                    setEditingPostId(null);
                    setNewQuestion('');
                  }}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold eco-forest-btn disabled:opacity-50 mr-2"
                >
                  Guardar cambios
                </button>
                <button
                  onClick={() => {
                    setEditingPostId(null);
                    setNewQuestion('');
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold eco-forest-btn text-emerald-50/90"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                disabled={!newQuestion.trim() || !user || !isOnline}
                onClick={() => {
                  if (!user || !newQuestion.trim() || !isOnline) return;
                  const displayName = vm.profile.name || (lang === 'en' ? 'User' : 'Usuario');
                  vm.addPost(displayName, newQuestion.trim());
                  setNewQuestion('');
                }}
                className="px-4 py-1.5 rounded-full text-xs font-semibold eco-forest-btn disabled:opacity-50"
              >
                {lang === 'en' ? 'Post question' : 'Publicar consulta'}
              </button>
            )}
          </div>
          {!user && (
            <p className="mt-1 text-[10px] text-gray-400">
              {lang === 'en'
                ? 'You must sign in to post and like.'
                : 'Debes iniciar sesión para publicar y dar like.'}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {pagedPosts.map(post => {
          const isOwner =
            !!user && !!post.ownerId && post.ownerId === user.id;

          return (
            <div key={post.id} className="eco-card-soft p-4 rounded-2xl">
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex gap-2 items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${post.user}`} alt="user"/>
                  </div>
                  <span className="text-xs font-bold">{post.user}</span>
                </div>
                {isOwner && (
                  <div className="flex gap-2">
                <button
                      onClick={() => {
                        setEditingPostId(post.id);
                        setNewQuestion(post.text);
                      }}
                    className="text-[10px] text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Edit2 size={12} />
                    {lang === 'en' ? 'Edit' : 'Editar'}
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            '¿Seguro que deseas eliminar esta consulta? Esta acción no se puede deshacer.'
                          )
                        ) {
                          vm.deletePost(post.id);
                          if (editingPostId === post.id) {
                            setEditingPostId(null);
                            setNewQuestion('');
                          }
                        }
                      }}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    {lang === 'en' ? 'Delete' : 'Eliminar'}
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600">{post.text}</p>
              <div className="flex gap-4 mt-4 text-gray-400">
              <button
                disabled={!user || !isOnline}
                  onClick={() => vm.toggleLike(post.id)}
                  className={`flex gap-1 items-center text-xs ${
                    post.hasLiked ? 'text-emerald-600' : ''
                  } ${!user || !isOnline ? 'opacity-40' : ''}`}
                >
                  <Heart size={14} />
                  {post.likes}
                </button>
              </div>
            </div>
          );
        })}
        {vm.posts.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={() => setCommentsPage(p => Math.max(0, p - 1))}
              disabled={commentsPage === 0}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold eco-forest-btn disabled:opacity-40"
            >
              {lang === 'en' ? 'Previous' : 'Anterior'}
            </button>
            <span className="text-[11px] text-emerald-50 font-semibold">
              {commentsPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCommentsPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={commentsPage >= totalPages - 1}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold eco-forest-btn disabled:opacity-40 flex items-center gap-1"
            >
              {lang === 'en' ? 'Next' : 'Siguiente'}
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="animate-fadeIn">
      <button
        onClick={() => vm.setView('feed')}
        className="mb-6 flex gap-2 items-center text-black-400"
      >
        <ChevronLeft />
        {lang === 'en' ? 'Back' : 'Volver'}
      </button>
      <div className="eco-card rounded-3xl p-6 text-center mb-6">
        <img src={vm.profile.avatar} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-emerald-50" alt="profile"/>
        <h3 className="text-xl font-bold">{vm.profile.name}</h3>
        <p className="text-[11px] text-gray-400">
          {lang === 'en'
            ? 'This display name is synchronized with your general profile. You can edit it from the profile menu.'
            : 'Este nombre visible se sincroniza con tu perfil general. Puedes editarlo desde el botón flotante de perfil.'}
        </p>
        {user && (
          <div className="mt-4 pt-3 border-t border-gray-100 text-left text-xs text-gray-500">
            <p className="font-semibold text-gray-700 mb-1">
              {lang === 'en' ? 'Account data' : 'Datos de tu cuenta'}
            </p>
            <p>
              <span className="font-medium">
                {lang === 'en' ? 'Email:' : 'Correo:'}&nbsp;
              </span>
              {user.email}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              {lang === 'en'
                ? 'This information comes from your sign‑in data. Later it can be synchronized with your full profile.'
                : 'Estos datos vienen de tu inicio de sesión. Más adelante podemos sincronizarlos con tu perfil completo.'}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="eco-card-soft p-4 rounded-2xl text-center">
          <span className="block font-black text-emerald-600 text-xl">{vm.profile.reportsCount}</span>
          <span className="text-[10px] text-gray-400 uppercase">
            {lang === 'en' ? 'Reports' : 'Reportes'}
          </span>
        </div>
        <div className="eco-card-soft p-4 rounded-2xl text-center">
          <span className="block font-black text-blue-600 text-xl">{vm.profile.points}</span>
          <span className="text-[10px] text-gray-400 uppercase">
            {lang === 'en' ? 'likes' : 'likes'}
          </span>
        </div>
      </div>

      {vm.topReport && (
        <div className="mt-6 eco-card-soft p-4 rounded-2xl text-left">
          <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">
            {lang === 'en' ? 'Report with most likes' : 'Reporte con más likes'}
          </p>
          <p className="text-sm font-bold text-emerald-900">{vm.topReport.title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {lang === 'en'
              ? 'It has received '
              : 'Ha recibido '}{' '}
            <span className="font-semibold text-orange-600">{vm.topReport.likes}</span>{' '}
            {lang === 'en' ? 'likes.' : 'likes.'}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4">
      {vm.view === 'feed' ? renderFeed() : renderProfile()}
    </div>
  );
};

export default Participation;
