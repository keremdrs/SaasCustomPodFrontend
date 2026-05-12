import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─────────────────────────────────────────────
  // 1) Auth state'ini takip et — DB ÇAĞRISI YOK
  //    onAuthStateChange callback'i senkron olmalı,
  //    aksi halde Supabase'in iç kilidiyle deadlock olur.
  // ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      // loading'i burada KAPATMIYORUZ; profile useEffect'i halledecek
      if (!session?.user) setLoading(false); // user yoksa direkt bitir
    }).catch((e) => {
      console.error('getSession error:', e);
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // SADECE state güncelle — await/Supabase çağrısı yok!
        setUser(session?.user ?? null);
        if (!session?.user) setProfile(null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ─────────────────────────────────────────────
  // 2) Profil yükle / yoksa oluştur — user değiştiğinde
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: existing, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('profile fetch error:', error);
          return;
        }

        if (existing) {
          setProfile(existing);
        } else {
          // Google OAuth ilk girişte profil yoksa oluştur
          const { data: created, error: insErr } = await supabase
            .from('profiles')
            .insert({ id: user.id, email: user.email })
            .select()
            .single();
          if (!cancelled && !insErr && created) setProfile(created);
        }
      } catch (e) {
        console.error('profile load exception:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const signOut = () => supabase.auth.signOut();

  const refreshProfile = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (data) setProfile(data);
    return data;
  };

  const needsOnboarding = !!profile && !profile.shop_slug;

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile, needsOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);