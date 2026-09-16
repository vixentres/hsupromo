import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, type Promotor } from './supabase';

interface AuthContextType {
  user: Omit<Promotor, 'clave'> | null;
  loading: boolean;
  login: (correo: string, clave: string) => Promise<{ success: boolean; message?: string; rol?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Omit<Promotor, 'clave'> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('hsu_user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch (e) { console.error(e); }
    }
    setLoading(false);
  }, []);

  const login = async (correo: string, clave: string) => {
    try {
      const { data, error } = await supabase
        .from('promotores')
        .select('*')
        .eq('correo', correo)
        .eq('clave', clave)
        .single();

      if (error || !data) return { success: false, message: 'Credenciales inválidas' };

      const { clave: _, ...userWithoutPassword } = data as Promotor;
      setUser(userWithoutPassword);
      localStorage.setItem('hsu_user', JSON.stringify(userWithoutPassword));
      return { success: true, rol: userWithoutPassword.rol };
    } catch {
      return { success: false, message: 'Error de red' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hsu_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
