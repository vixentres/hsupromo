import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

interface User {
  id?: string;
  nombre: string;
  rut: string;
  correo: string;
  instagram: string;
  chat_link: string;
  rol: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (correo: string, clave: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('hsu_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Error parsing stored user", e);
      }
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

      if (error || !data) {
        return { success: false, message: 'Credenciales inválidas' };
      }

      const { clave: _, ...userWithoutPassword } = data;
      setUser(userWithoutPassword as User);
      localStorage.setItem('hsu_user', JSON.stringify(userWithoutPassword));
      return { success: true };
    } catch (error) {
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

