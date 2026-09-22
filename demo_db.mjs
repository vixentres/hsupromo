import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wgnbxvixhqfqshprmevl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnbmJ4dml4aHFmcXNocHJtZXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1Nzk5NTMsImV4cCI6MjEwNTE1NTk1M30.MOY1pMFn6Bey0Uk1zXOrDX4xsHaB8XmLSWVXp4eMEXA'
);

async function run() {
  // 1. Obtener promotores
  const { data: promotores } = await supabase.from('promotores').select('*').eq('rol', 'promotor');
  if (!promotores || promotores.length === 0) return console.log('No promotores');

  // 2. Obtener tareas ordenadas por fecha
  const { data: tareas } = await supabase.from('tareas').select('*').order('fecha_tarea', { ascending: false });
  
  if (tareas.length > 5) {
    const toDelete = tareas.slice(5).map(t => t.id);
    await supabase.from('revisiones').delete().in('tarea_id', toDelete);
    await supabase.from('tareas').delete().in('id', toDelete);
    tareas.length = 5;
    console.log('Eliminadas tareas antiguas');
  }

  // 3. Modificar tareas para la demo
  for (let i = 0; i < tareas.length; i++) {
    const tarea = tareas[i];
    await supabase.from('revisiones').delete().eq('tarea_id', tarea.id);
    console.log('Reescribiendo revisiones para tarea:', tarea.fecha_tarea);
    
    const selfRows = [];
    const auditRows = [];

    // Promotores
    promotores.forEach((p, idx) => {
      // Determinar estado basado en el índice y el día
      let status = 'verde';
      let adminOverride = null;
      let submission = 'rojo';

      if (i === 0 || i === 1) {
        // Para los últimos 2 días, variar colores
        const mod = idx % 5;
        if (mod === 0) { submission = 'amarillo'; } // amarillo
        else if (mod === 1) { submission = 'rojo'; } // rojo
        else if (mod === 2) { submission = 'rojo'; adminOverride = 'naranja'; } // naranja
        else if (mod === 3) { submission = 'rojo'; adminOverride = 'morado'; } // morado
        else { submission = 'rojo'; adminOverride = 'verde'; } // verde
      } else {
        // Días anteriores todos en verde
        adminOverride = 'verde';
      }

      selfRows.push({
        tarea_id: tarea.id,
        promotor_id: p.id,
        auditor_id: p.id,
        voto: 'SI',
        submission_status: submission,
        admin_override: adminOverride
      });

      // 1 auditor por persona
      const audIdx = (idx + 1) % promotores.length;
      auditRows.push({
        tarea_id: tarea.id,
        promotor_id: promotores[audIdx].id,
        auditor_id: p.id,
        voto: 'PENDIENTE',
        submission_status: 'rojo' // irrelevant
      });
    });

    await supabase.from('revisiones').insert([...selfRows, ...auditRows]);
  }

  // Vendedores (opcional, todos en verde)
  const { data: vendedores } = await supabase.from('promotores').select('*').eq('rol', 'vendedor');
  if (vendedores && vendedores.length > 0) {
    for (const tarea of tareas) {
      const vendRows = vendedores.map(v => ({
        tarea_id: tarea.id,
        promotor_id: v.id,
        auditor_id: v.id,
        voto: 'SI',
        submission_status: 'rojo',
        admin_override: 'verde'
      }));
      await supabase.from('revisiones').insert(vendRows);
    }
  }

  console.log('Done!');
}
run();
