import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Iniciando generación de datos...');

  // 1. Obtener promotores (solo rol promotor)
  const { data: promotores } = await supabase.from('promotores').select('*').eq('rol', 'promotor');
  if (!promotores || promotores.length === 0) return console.error('No hay promotores');

  // Limpiar datos existentes
  await supabase.from('metricas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('revisiones').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tareas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Datos limpios.');

  const dates = ['2026-09-08', '2026-09-10', '2026-09-12', '2026-09-16'];
  const NUM_AUDITORES = 2; // Configurado para 2 revisiones cruzadas

  for (let i = 0; i < dates.length; i++) {
    const fecha = dates[i];
    
    // Crear tarea
    const { data: tarea } = await supabase.from('tareas').insert({
      titulo: `Misión ${fecha}`,
      horas_duracion: 24,
      material_nuevo: '',
      activa: i === 3, // solo la de hoy activa
      fecha_tarea: fecha,
      created_at: `${fecha}T10:00:00Z`
    }).select().single();

    const tId = tarea.id;
    let selfRows = [];
    let auditRows = [];

    // Generar Asignaciones
    promotores.forEach((p, idx) => {
      // Determinar estado basado en el día
      let status = 'verde';
      if (i === 0 || i === 1) status = 'verde'; // Dias 1 y 2: Todo OK
      else if (i === 2) {
        // Dia 3: Mixto
        const r = Math.random();
        if (r < 0.2) status = 'rojo';
        else if (r < 0.4) status = 'amarillo';
        else if (r < 0.6) status = 'naranja';
        else status = 'verde';
      } else {
        // Dia 4: Escenarios específicos
        if (idx === 0) status = 'rojo';
        else if (idx === 1) status = 'verde';
        else if (idx === 2) status = 'amarillo';
        else if (idx === 3) status = 'morado';
        else if (idx === 4) status = 'naranja';
        else status = 'rojo'; // El 6to con auditor mintiendo
      }

      selfRows.push({
        tarea_id: tId,
        promotor_id: p.id,
        auditor_id: p.id,
        submission_status: status,
        voto: 'SI',
        created_at: `${fecha}T10:05:00Z`
      });

      // Asignar 2 auditores
      for (let k = 1; k <= NUM_AUDITORES; k++) {
        const audIdx = (idx + k) % promotores.length;
        const auditor = promotores[audIdx];
        
        let voto = 'SI';
        if (i < 2) voto = 'SI';
        else if (i === 2) voto = Math.random() > 0.5 ? 'SI' : (Math.random() > 0.5 ? 'NO' : 'PENDIENTE');
        else { // Dia 4
          if (status === 'amarillo') voto = 'PENDIENTE';
          else if (status === 'verde') voto = 'SI';
          else if (status === 'rojo' && idx === 0 && auditor.id === promotores[3].id) voto = 'NO'; // morado auditando a rojo
          else if (status === 'rojo' && idx === 5) voto = 'SI'; // auditor mintiendo a rojo
          else voto = 'NO';
        }

        auditRows.push({
          tarea_id: tId,
          promotor_id: p.id,
          auditor_id: auditor.id,
          voto: voto,
          created_at: `${fecha}T10:10:00Z`
        });
      }
    });

    await supabase.from('revisiones').insert([...selfRows, ...auditRows]);
    console.log(`Tarea ${fecha} creada con asignaciones.`);
  }

  // Generar métricas falsas (muchos clicks)
  console.log('Generando métricas...');
  const metricas = [];
  const startDay = 8;
  for (let d = startDay; d <= 16; d++) {
    const dStr = `2026-09-${d.toString().padStart(2, '0')}`;
    promotores.forEach(p => {
      const visitas = Math.floor(Math.random() * 50) + 10;
      const tms = Math.floor(visitas * (Math.random() * 0.3));
      const gratis = Math.floor(visitas * (Math.random() * 0.2));

      for(let v=0; v<visitas; v++) metricas.push({ promotor_id: p.id, tipo_accion: 'visita', created_at: `${dStr}T12:00:00Z` });
      for(let t=0; t<tms; t++) metricas.push({ promotor_id: p.id, tipo_accion: 'click_tm', created_at: `${dStr}T13:00:00Z` });
      for(let g=0; g<gratis; g++) metricas.push({ promotor_id: p.id, tipo_accion: 'click_gratis', created_at: `${dStr}T14:00:00Z` });
    });
  }
  
  // Insertar en lotes de 1000
  for (let i = 0; i < metricas.length; i += 1000) {
    await supabase.from('metricas').insert(metricas.slice(i, i + 1000));
  }

  console.log('Datos mock generados correctamente.');
}

run();
