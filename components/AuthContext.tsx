import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ensureProfile = async (u: User) => {
      try {
        const { data, error, status } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', u.id)
          .maybeSingle();

        if ((!data && status !== 406) || error) {
          // Si hay otro tipo de error, solo lo registramos en consola
          console.warn('Error verificando perfil de usuario:', error);
          return;
        }

        const preferredUsername =
          (u.user_metadata as any)?.username ||
          (u.email || '').split('@')[0] ||
          'guardian_humedal';

        // Si no hay fila, la creamos; si la hay pero sin username/visible, la completamos.
        if (!data) {
          await supabase.from('profiles').upsert(
            {
              id: u.id,
              username: preferredUsername,
              display_name: preferredUsername,
            },
            { onConflict: 'id' }
          );
        } else {
          const currentUsername = (data as any).username as string | null;
          const currentDisplayName = (data as any).display_name as string | null;
          if (!currentUsername || !currentDisplayName) {
            await supabase
              .from('profiles')
              .update({
                username: currentUsername || preferredUsername,
                display_name: currentDisplayName || preferredUsername,
              })
              .eq('id', u.id);
          }
        }
      } catch (err) {
        console.warn('No se pudo asegurar el perfil del usuario:', err);
      }
    };

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await ensureProfile(currentUser);
      }
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        // No esperamos aquí para no bloquear el cambio de estado
        ensureProfile(u);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUp = async (email: string, password: string, username: string) => {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      return { error: 'USERNAME_REQUIRED' };
    }

    // Comprobación rápida de que el nombre de usuario no exista ya en perfiles.
    // Si las políticas RLS no lo permiten, simplemente continuamos sin bloquear el registro.
    try {
      const { data: existing, error: usernameError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (!usernameError && existing) {
        return { error: 'USERNAME_TAKEN' };
      }
    } catch (err) {
      console.warn('No se pudo verificar la unicidad del nombre de usuario:', err);
    }

    const configuredRedirect =
      (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim() || '';
    const redirectUrl =
      configuredRedirect || `${window.location.origin}/confirmacion-cuenta.html`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: cleanUsername },
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) return { error: error.message };

    // Supabase puede devolver éxito "silencioso" cuando el correo ya existe
    // (user con identities vacío) para evitar enumeración de cuentas.
    const identities = (data?.user as any)?.identities as any[] | undefined;
    if (Array.isArray(identities) && identities.length === 0) {
      return { error: 'EMAIL_ALREADY_REGISTERED' };
    }

    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
};
