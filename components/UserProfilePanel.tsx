import React, { useEffect, useState } from 'react';
import { X, Shield, Search } from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { useLanguage } from './LanguageContext';

interface UserProfilePanelProps {
  onClose: () => void;
}

const UserProfilePanel: React.FC<UserProfilePanelProps> = ({ onClose }) => {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState<string | null>(null);
  const [userRoleMessage, setUserRoleMessage] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<
    {
      id: string;
      username: string | null;
      display_name: string | null;
      email: string | null;
      role: string | null;
    }[]
  >([]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('profiles')
        .select('username, display_name, role')
        .eq('id', user.id)
        .single();

      if (!err && data) {
        const fromProfile = data.username || data.display_name || '';
        setUsername(fromProfile);
        if (data.role === 'admin') {
          setIsAdmin(true);
        }
      } else {
        // Fallback: usar el username guardado en metadata o el prefijo del correo
        const metaUsername =
          ((user.user_metadata as any)?.username as string | undefined) ||
          (user.email || '').split('@')[0] ||
          '';
        setUsername(metaUsername);
      }
      setLoading(false);
    };

    loadProfile().catch(() => setLoading(false));
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setError(
        lang === 'en'
          ? 'Please enter a username.'
          : 'Por favor ingresa un nombre de usuario.'
      );
      setLoading(false);
      return;
    }

    // Validar unicidad del nombre de usuario antes de guardar
    try {
      const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', user.id)
        .maybeSingle();

      if (existingError) {
        console.warn('No se pudo validar unicidad del username:', existingError.message);
      }

      if (existing) {
        setError(
          lang === 'en'
            ? 'This username is already in use. Please choose a different one.'
            : 'Este nombre de usuario ya está en uso. Elige uno diferente.'
        );
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Error validando username:', err);
    }

    // Actualizar nombre de usuario en los metadatos de autenticación
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { username: cleanUsername || null },
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      setError('No se pudo actualizar tu nombre de usuario. Intenta de nuevo.');
      setLoading(false);
      return;
    }

    // Intentar reflejarlo también en la tabla profiles (si las políticas lo permiten)
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          username: cleanUsername || null,
          display_name: cleanUsername || null,
        },
        { onConflict: 'id' }
      );

    if (upsertError) {
      const lower = (upsertError.message || '').toLowerCase();
      if (lower.includes('duplicate key') || lower.includes('unique')) {
        setError(
          lang === 'en'
            ? 'This username is already in use. Please choose a different one.'
            : 'Este nombre de usuario ya está en uso. Elige uno diferente.'
        );
      } else {
        setError(
          lang === 'en'
            ? 'The username could not be updated. Please try again.'
            : 'No se pudo actualizar el nombre de usuario. Intenta de nuevo.'
        );
      }
    } else {
      setUsername(cleanUsername);
      setMessage(
        lang === 'en'
          ? 'Username updated successfully.'
          : 'Nombre de usuario actualizado correctamente.'
      );
    }

    setLoading(false);
  };

  if (!user) return null;

  const handleUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSearchError(null);
    setUserRoleMessage(null);
    if (!userSearch.trim()) return;

    setUserSearchLoading(true);
    const term = userSearch.trim();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, role')
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .limit(20);

    if (error) {
      setUserSearchError('No se pudieron cargar los usuarios. Revisa tus permisos.');
      setManagedUsers([]);
    } else if (data) {
      setManagedUsers(
        data.map(row => ({
          id: (row as any).id as string,
          username: (row as any).username ?? null,
          display_name: (row as any).display_name ?? null,
          email: (row as any).email ?? null,
          role: (row as any).role ?? 'user',
        }))
      );
      if (data.length === 0) {
        setUserSearchError('No se encontraron usuarios con ese criterio.');
      }
    }
    setUserSearchLoading(false);
  };

  const handleChangeManagedRole = (id: string, role: string) => {
    setManagedUsers(prev => prev.map(u => (u.id === id ? { ...u, role } : u)));
  };

  const handleSaveManagedRole = async (id: string) => {
    const target = managedUsers.find(u => u.id === id);
    if (!target) return;

    setUserRoleMessage(null);
    setUserSearchError(null);

    if (!isAdmin) {
      setUserSearchError('Tu cuenta no tiene permisos de administrador para cambiar roles.');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ role: target.role })
      .eq('id', id)
      .select('id, role')
      .single();

    if (error) {
      const low = error.message.toLowerCase();
      if (low.includes('row-level security') || error.code === '42501') {
        setUserSearchError(
          'No se pudo actualizar el rol por políticas de seguridad (RLS) en Supabase.'
        );
      } else {
        setUserSearchError(`No se pudo actualizar el rol del usuario: ${error.message}`);
      }
    } else {
      setManagedUsers(prev =>
        prev.map(u => (u.id === id ? { ...u, role: (data as any)?.role ?? target.role } : u))
      );
      setUserRoleMessage('Rol de usuario actualizado correctamente.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-start justify-center px-3 pb-3 overflow-y-auto"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <div className="w-full max-w-md rounded-3xl p-5 relative max-h-[calc(100vh-env(safe-area-inset-top,0px)-1.5rem)] overflow-y-auto no-scrollbar border border-emerald-100/70 bg-[rgba(238,242,240,0.95)] shadow-[0_18px_45px_rgba(16,24,20,0.28)] backdrop-blur-md">
        <div className="sticky top-0 z-20 bg-[rgba(238,242,240,0.94)] backdrop-blur-md pb-2 mb-3 border-b border-emerald-100/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-emerald-950 mb-1">Tu perfil</h2>
              <p className="text-xs text-slate-600">
                Revisa tus datos de cuenta y ajusta tu nombre visible o nombre de usuario.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
                  Idioma
                </span>
                <select
                  value={lang}
                  onChange={e => setLang(e.target.value === 'en' ? 'en' : 'es')}
                  className="text-[11px] border border-emerald-100 rounded-lg px-2 py-1 bg-white/75 text-slate-700"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-700 mt-0.5"
                aria-label="Cerrar perfil"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 text-xs text-gray-700 rounded-2xl p-3 border border-emerald-100/70 bg-[rgba(237,244,241,0.9)]">
          <p className="font-semibold text-emerald-800 mb-1">
            {lang === 'en' ? 'Sign‑in data' : 'Datos de inicio de sesión'}
          </p>
          <p>
            <span className="font-medium">
              {lang === 'en' ? 'Email:' : 'Correo:'}&nbsp;
            </span>
            {user.email}
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              {lang === 'en' ? 'Username' : 'Nombre de usuario'}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-3 rounded-xl border border-emerald-100 bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: humedal_guardian"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {lang === 'en'
                ? 'It will be used as @username in your reports. Later we will validate that it is unique.'
                : 'Se usará como @usuario en tus reportes. Más adelante validaremos que no se repita.'}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">
              {error}
            </p>
          )}
          {message && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 eco-forest-btn rounded-xl text-sm font-semibold disabled:opacity-60"
          >
            {loading
              ? lang === 'en'
                ? 'Saving...'
                : 'Guardando...'
              : lang === 'en'
              ? 'Save changes'
              : 'Guardar cambios'}
          </button>
        </form>

        {isAdmin && (
          <div className="mt-6 pt-4 border-t border-emerald-100/80">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Shield size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-widest">
                  {lang === 'en' ? 'User management' : 'Gestión de usuarios'}
                </p>
                <p className="text-[11px] text-gray-500">
                  {lang === 'en'
                    ? 'Search by username to change the role.'
                    : 'Busca por nombre de usuario para cambiar el rol.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleUserSearch} className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-emerald-100 bg-white/70 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={
                    lang === 'en'
                      ? 'E.g.: humedal_guardian or email'
                      : 'Ej: humedal_guardian o correo'
                  }
                />
              </div>
              <button
                type="submit"
                disabled={userSearchLoading || !userSearch.trim()}
                className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-60"
              >
                {userSearchLoading
                  ? lang === 'en'
                    ? 'Searching...'
                    : 'Buscando...'
                  : lang === 'en'
                  ? 'Search'
                  : 'Buscar'}
              </button>
            </form>

            {userSearchError && (
              <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl p-2 mb-2">
                {userSearchError}
              </p>
            )}
            {userRoleMessage && (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2 mb-2">
                {userRoleMessage}
              </p>
            )}

            {managedUsers.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar">
                {managedUsers.map(u => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-emerald-100/70 bg-[rgba(255,255,255,0.68)]"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-800">
                        {u.display_name ||
                          u.username ||
                          (lang === 'en' ? 'User without name' : 'Usuario sin nombre')}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {u.username
                          ? `@${u.username}`
                          : lang === 'en'
                          ? 'No username'
                          : 'Sin usuario'}{' '}
                        {u.email ? `• ${u.email}` : ''}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <select
                        value={u.role ?? 'user'}
                        onChange={e => handleChangeManagedRole(u.id, e.target.value)}
                        className="text-[11px] border border-emerald-100 rounded-lg px-2 py-1 bg-white/75"
                      >
                        <option value="user">
                          {lang === 'en' ? 'User' : 'Usuario'}
                        </option>
                        <option value="admin">
                          {lang === 'en' ? 'Administrator' : 'Administrador'}
                        </option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSaveManagedRole(u.id)}
                        className="text-[10px] text-emerald-700 font-semibold"
                      >
                        {lang === 'en' ? 'Save' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-3 border-t border-emerald-100/50 sticky bottom-0 bg-transparent">
          <button
            onClick={async () => {
              await signOut();
              onClose();
            }}
            className="w-full py-2.5 bg-red-50/80 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold border border-red-100 transition-colors"
          >
            {lang === 'en' ? 'Sign out' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePanel;
