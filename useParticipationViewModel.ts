
import { useState, useEffect, useMemo } from 'react';
import { UserProfile } from './types';
import { useAuth } from './components/AuthContext';
import { supabase } from './services/supabaseClient';

type CommunityPost = {
  id: string;
  user: string;
  text: string;
  likes: number;
  hasLiked: boolean;
  createdAt: number;
  ownerId: string | null;
};

export const useParticipationViewModel = () => {
  const [view, setView] = useState<'feed' | 'profile'>('feed');
  const [isEditing, setIsEditing] = useState(false);
  const { user: authUser } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Explorador del Techo',
    bio: '',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    level: 'Guardián Nivel 1',
    reportsCount: 0,
    points: 0,
  });

  const [topReport, setTopReport] = useState<{ title: string; likes: number } | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!authUser) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username, role')
        .eq('id', authUser.id)
        .single();

      if (!error && data) {
        let reportsCount = 0;
        let totalLikes = 0;
        let best: { title: string; likes: number } | null = null;

        // Estadísticas basadas en las publicaciones de comunidad del usuario actual
        const { data: postsData, error: postsError } = await supabase
          .from('community_queries')
          .select('text, likes_count')
          .eq('user_id', authUser.id);

        if (!postsError && postsData) {
          reportsCount = postsData.length;
          postsData.forEach((p: any) => {
            const likes = p.likes_count ?? 0;
            totalLikes += likes;
            if (!best || likes > best.likes) {
              best = { title: p.text as string, likes };
            }
          });
        }

        const usernameFromProfile =
          data.username || data.display_name || null;
        const fallbackUsername =
          (authUser.user_metadata as any)?.username ||
          authUser.email?.split('@')[0] ||
          '';
        const username = usernameFromProfile || fallbackUsername;

        setProfile(prev => ({
          ...prev,
          name: username || prev.name,
          avatar: data.username
            ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                data.username
              )}`
            : prev.avatar,
          reportsCount,
          points: totalLikes,
        }));
        setProfileUsername(username || null);
        setTopReport(best);
        if (data.role === 'admin') {
          setIsAdmin(true);
        }
      } else {
        // Fallback si no se pudo leer profiles: usar metadatos o correo
        const username =
          (authUser.user_metadata as any)?.username ||
          authUser.email?.split('@')[0] ||
          '';
        setProfile(prev => ({
          ...prev,
          name: username || prev.name,
        }));
        setProfileUsername(username || null);
      }
    };

    loadProfile().catch(err => {
      console.error('Error cargando perfil de comunidad:', err);
    });
  }, [authUser]);

  // Cargar likes persistentes por usuario desde Supabase.
  useEffect(() => {
    const loadLikedPostIds = async () => {
      if (!authUser) {
        setLikedPostIds([]);
        return;
      }

      const { data, error } = await supabase
        .from('community_query_likes')
        .select('query_id')
        .eq('user_id', authUser.id);

      if (!error && data) {
        const ids = data
          .map((row: any) => row.query_id as string | null)
          .filter((id): id is string => !!id);
        setLikedPostIds(ids);
      } else if (error) {
        console.error('Error cargando likes del usuario en comunidad:', error.message);
        setLikedPostIds([]);
      }
    };

    loadLikedPostIds().catch(err => {
      console.error('Error inesperado cargando likes del usuario en comunidad:', err);
      setLikedPostIds([]);
    });
  }, [authUser]);

  const updateProfile = (data: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...data }));
  };

  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const [sortMode, setSortMode] = useState<'latest' | 'top'>('latest');

  useEffect(() => {
    const loadPosts = async () => {
      const { data, error } = await supabase
        .from('community_queries')
        .select('id, user_id, text, likes_count, author_name, author_username, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const mapped: CommunityPost[] = data.map((row: any) => {
          const username = row.author_username as string | null;
          const authorName = row.author_name as string | null;
          let displayUser: string;
          if (username) {
            displayUser = `@${username}`;
          } else if (authorName) {
            displayUser = authorName.split('@')[0] || 'Usuario';
          } else {
            displayUser = 'Usuario';
          }

          return {
            id: row.id as string,
            user: displayUser,
            text: row.text,
            likes: row.likes_count ?? 0,
            hasLiked: false,
            createdAt: new Date(row.created_at).getTime(),
            ownerId: (row.user_id as string | null) ?? null,
          };
        });
        if (authUser) {
          const likedSet = new Set(likedPostIds);
          setPosts(
            mapped.map(post => ({
              ...post,
              hasLiked: likedSet.has(post.id),
            }))
          );
        } else {
          setPosts(mapped);
        }
      } else if (error) {
        console.error('Error cargando consultas de comunidad desde Supabase:', error.message);
      }
    };

    loadPosts().catch(err => {
      console.error('Error inesperado cargando consultas de comunidad:', err);
    });
  }, [authUser, likedPostIds]);

  const displayedPosts = useMemo(() => {
    const sorted = [...posts].sort((a, b) => {
      if (sortMode === 'latest') {
        return b.createdAt - a.createdAt;
      }
      return b.likes - a.likes;
    });
    return sorted.slice(0, 15);
  }, [posts, sortMode]);

  // Sincroniza la marca hasLiked contra los ids persistidos en BD.
  useEffect(() => {
    if (!authUser || !posts.length) return;

    setPosts(prev => {
      let changed = false;
      const likedSet = new Set(likedPostIds);
      const updated = prev.map(p => {
        const shouldBeLiked = likedSet.has(p.id);
        if (p.hasLiked !== shouldBeLiked) {
          changed = true;
          return { ...p, hasLiked: shouldBeLiked };
        }
        return p;
      });
      return changed ? updated : prev;
    });
  }, [authUser, likedPostIds, posts.length]);

  const toggleLike = async (id: string) => {
    if (!authUser) return;

    const current = posts.find(p => p.id === id);
    if (!current) return;

    const nextHasLiked = !current.hasLiked;
    const delta = nextHasLiked ? 1 : -1;
    const nextLikes = Math.max(0, current.likes + delta);

    setPosts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, hasLiked: nextHasLiked, likes: nextLikes } : p
      )
    );

    if (nextHasLiked) {
      const { error: insertLikeError } = await supabase
        .from('community_query_likes')
        .insert({ query_id: id, user_id: authUser.id });

      // Si ya existe el like por restricción UNIQUE, tratamos como estado final válido.
      if (insertLikeError && insertLikeError.code !== '23505') {
        console.error('Error insertando like de comunidad:', insertLikeError.message);
        setPosts(prev =>
          prev.map(p => (p.id === id ? { ...p, hasLiked: current.hasLiked, likes: current.likes } : p))
        );
        return;
      }
    } else {
      const { error: deleteLikeError } = await supabase
        .from('community_query_likes')
        .delete()
        .eq('query_id', id)
        .eq('user_id', authUser.id);

      if (deleteLikeError) {
        console.error('Error quitando like de comunidad:', deleteLikeError.message);
        setPosts(prev =>
          prev.map(p => (p.id === id ? { ...p, hasLiked: current.hasLiked, likes: current.likes } : p))
        );
        return;
      }
    }

    const { error: updateCountError } = await supabase
      .from('community_queries')
      .update({ likes_count: nextLikes })
      .eq('id', id);

    if (updateCountError) {
      console.error('Error actualizando likes_count de comunidad:', updateCountError.message);
      // Revertimos estado local ante falla de persistencia.
      setPosts(prev =>
        prev.map(p => (p.id === id ? { ...p, hasLiked: current.hasLiked, likes: current.likes } : p))
      );
      return;
    }

    setLikedPostIds(prevIds => {
      const set = new Set(prevIds);
      if (nextHasLiked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });

    // Si el post es del usuario actual, ajustar estadísticas del perfil en memoria
    if (current.ownerId === authUser.id) {
      const updatedPosts = posts.map(p =>
        p.id === id ? { ...p, hasLiked: nextHasLiked, likes: nextLikes } : p
      );
      const ownPosts = updatedPosts.filter(p => p.ownerId === authUser.id);
      const reportsCount = ownPosts.length;
      let totalLikes = 0;
      let best: { title: string; likes: number } | null = null;
      ownPosts.forEach(p => {
        totalLikes += p.likes;
        if (!best || p.likes > best.likes) {
          best = { title: p.text, likes: p.likes };
        }
      });
      setProfile(prev => ({
        ...prev,
        reportsCount,
        points: totalLikes,
      }));
      setTopReport(best);
    }
  };

  const addPost = (displayName: string, text: string) => {
    if (!authUser) return;

    const tempId = `local-${Date.now()}`;
    const newPost: CommunityPost = {
      id: tempId,
      user: profileUsername ? `@${profileUsername}` : displayName,
      text,
      likes: 0,
      hasLiked: false,
      createdAt: Date.now(),
      ownerId: authUser.id,
    };

    setPosts(prev => [newPost, ...prev]);

    (async () => {
      const { data, error } = await supabase
        .from('community_queries')
        .insert({
          text,
          likes_count: 0,
          author_name: displayName,
          author_username: profileUsername,
          user_id: authUser.id,
        })
        .select('id')
        .single();

      if (!error && data?.id) {
        setPosts(prev =>
          prev.map(p =>
            p.id === tempId ? { ...p, id: data.id as string } : p
          )
        );
      } else if (error) {
        console.error('Error guardando consulta de comunidad en Supabase:', error.message);
      }
    })().catch(err => {
      console.error('Error inesperado guardando consulta de comunidad:', err);
    });
  };

  const updatePost = (id: string, newText: string) => {
    setPosts(prev =>
      prev.map(p => (p.id === id ? { ...p, text: newText } : p))
    );

    supabase
      .from('community_queries')
      .update({ text: newText })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('Error actualizando consulta de comunidad:', error.message);
        }
      })
      .catch(err => {
        console.error('Error inesperado actualizando consulta de comunidad:', err);
      });
  };

  const deletePost = (id: string) => {
    supabase
      .from('community_queries')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('Error eliminando consulta de comunidad:', error.message);
          alert('No se pudo eliminar la consulta. Revisa tus permisos en la cuenta.');
        } else {
          setPosts(prev => prev.filter(p => p.id !== id));
        }
      })
      .catch(err => {
        console.error('Error inesperado eliminando consulta de comunidad:', err);
        alert('Ocurrió un error eliminando la consulta. Intenta de nuevo.');
      });
  };

  const [userActivity] = useState([
    { type: 'post', text: 'Reporté un avistamiento de Tingua Azul.', time: 'Hace 2 días' },
    { type: 'like', text: 'Le diste me gusta al post de Ana P.', time: 'Hace 3 días' },
  ]);

  return {
    view,
    setView,
    isEditing,
    setIsEditing,
    profile,
    updateProfile,
    userActivity,
    posts: displayedPosts,
    sortMode,
    setSortMode,
    toggleLike,
    addPost,
    topReport,
    isAdmin,
    updatePost,
    deletePost,
  };
};
