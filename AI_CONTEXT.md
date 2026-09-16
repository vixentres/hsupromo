# Contexto del Proyecto: HSU Promo (Maqueta Demostrativa)

**Hola, agente de IA.** 
Si estás leyendo esto, es porque has sido invocado por el usuario para continuar el desarrollo de este proyecto en una nueva estación de trabajo. Este documento contiene todo el contexto, reglas de negocio y flujos que debes conocer para no perder el hilo.

## 1. Propósito y Finalidad
Este proyecto (`hsupromo`) es una **maqueta web paralela y demostrativa**. No está conectada a la base de datos principal de Supabase del cliente.
Su propósito es servir como una "prueba de concepto" totalmente funcional que el cliente presentará a otra organización para integrarla en un dominio oficial. 

El sistema gestiona **promotores y embajadores** de eventos, su seguimiento de referidos (analytics) y un sistema de validación de tareas publicitarias gamificado.

## 2. Stack Tecnológico
* **Frontend:** React + Vite, TypeScript, TailwindCSS, React Router.
* **Backend (Base de Datos):** Google Sheets conectado a través de Google Apps Script. El código del script backend se encuentra en `google_apps_script_db.js`.
* **Conexión:** Las llamadas a la base de datos se realizarán usando la función `fetchGAS` ubicada en `src/lib/api.ts`.

## 3. Flujo y Roles

Existen 3 rutas principales:
1. **`/` (Landing Page):** Página pública. Los promotores envían tráfico aquí usando su link `?ref=ID`. Se deben contar las vistas y los clicks en los botones de "Ticketmaster" o "Entradas sin cargo".
2. **`/admin` (Admin Panel):** Acceso privado del administrador.
3. **`/promotor/login` y `/promotor/dashboard`:** Acceso de los promotores.

### Funciones del Administrador:
* **Gestión de Usuarios:** Crear promotores (Nombre, RUT, Correo, Clave, Instagram). *Dato crítico:* El usuario debe avisar si cambia su @ de Instagram para que el sistema no rompa los links de revisión.
* **Configuración Global:** El admin pega los URLs de las carpetas de Google Drive (Material Nuevo y Material Histórico) y la URL directa de la imagen del banner para el Landing.
* **Gestión de Tareas:** El admin lanza misiones diarias (ej. "Subir Banner") con un límite de 24h o 48h.
* **Analíticas:** Ver tabla de clicks y tráfico generado por cada promotor.

## 4. El Corazón del Sistema: "Revisión Cruzada" (Gamificación)
Este es el mecanismo más complejo e importante del proyecto. Es un sistema de consenso distribuido para evitar que el admin tenga que revisar a 100 personas manualmente.

**¿Cómo funciona?**
1. Cuando el Admin lanza una tarea, el sistema asigna aleatoriamente a cada promotor **N compañeros** para auditar (ej. 2 o 3, dependiendo del tamaño del equipo).
2. En el panel del promotor, él debe marcar su propia tarea como "Publicada", pero también **debe ir al Instagram de sus compañeros asignados** y votar si ellos subieron la historia o no (`SÍ`, `NO`, `Justificado`).
3. El promotor solo completa su misión al 100% si hace su propia publicación **Y** audita a los que le tocaron.

**El Mapa de Calor (Reglas de Colores):**
* 🔴 **Rojo (Pendiente/Castigado):** No ha hecho la tarea, o fue descubierto mintiendo.
* 🟡 **Amarillo (En Revisión):** El promotor hizo click en "Publicado", pero sus auditores aún no confirman.
* 🟢 **Verde (Aprobado):** El promotor publicó y sus auditores votaron "SÍ".
* 🟣 **Morado (Auditor Leal):** *Regla crítica:* Si el Promotor A hizo su tarea, pero le tocó auditar al Promotor B y B desapareció o no la hizo, el Promotor A votará "NO". El estado de A se vuelve Morado. El Morado es un color "bueno", significa "Yo cumplí y audité bien, mi compañero me falló". A no es castigado.
* 🟧 **Naranja (Justificado):** Por permisos internos.

**El "Castigo Divino" del Admin:**
Para evitar que un grupo de amigos vote "SÍ" entre ellos sin subir nada, el Admin hace auditorías aleatorias solo a los que están en 🟢 Verde. Si el Admin va a revisar un Verde y resulta que no hay historia, **se castiga (Rojo) al promotor que mintió y a todos los compañeros auditores que votaron "SÍ" para encubrirlo.** Esto fuerza una honestidad radical en la comunidad.

## 5. Estado Actual del Desarrollo
* Se ha configurado el "esqueleto" visual (UI) con TailwindCSS y las vistas simuladas en duro.
* El archivo de Google Apps Script está escrito pero el cliente debe desplegarlo.
* **Siguiente paso lógico para ti (IA):** Implementar la gestión real de estado en React (States/Context), conectar las vistas al `fetchGAS`, y programar el **algoritmo matemático de asignación aleatoria circular** de las revisiones cruzadas al momento de crear una tarea en el panel de Admin.

¡Éxito continuando la misión!
