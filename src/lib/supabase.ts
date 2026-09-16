import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Tipos ────────────────────────────────────────────────────
export type Rol = 'promotor' | 'admin';
export type EstadoColor = 'rojo' | 'amarillo' | 'verde' | 'morado' | 'naranja';
export type VotoAuditoria = 'SI' | 'NO' | 'JUSTIFICADO' | 'PENDIENTE';

export interface Promotor {
  id: string;
  nombre: string;
  rut: string;
  correo: string;
  clave: string;
  instagram: string;
  rol: Rol;
  created_at?: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  material_nuevo: string;
  material_historico: string;
  horas_duracion: number;
  activa: boolean;
  fecha_tarea: string;
  created_at?: string;
}

export interface Revision {
  id: string;
  tarea_id: string;
  promotor_id: string;
  auditor_id: string;
  voto: VotoAuditoria;
  submission_status: EstadoColor;
  admin_override: EstadoColor | null;
  created_at?: string;
}

export interface Config {
  id: number;
  banner_url: string;
  material_nuevo_url: string;
  material_historico_url: string;
  auditores_por_tarea: number;
}
