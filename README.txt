GAP — AGENDA DINÁMICA Y GESTIÓN EN /CHINO

El proyecto conserva la landing original en index.html y agrega una agenda pública
alimentada desde Supabase, fichas /evento/<slug> y un panel privado en /chino.

ARQUITECTURA
- Sitio y funciones HTTP: Netlify Free (funciones y dominio propio incluidos,
  con límite mensual de uso que pausa el servicio al alcanzarse).
- Base de datos e imágenes: Supabase Free (Postgres y Storage).
- Acceso: usuario propio de GAP, contraseñas bcrypt y sesiones HttpOnly/Secure.
- La clave service_role se usa únicamente en funciones del servidor.
- Las imágenes aceptadas son JPG, PNG y WebP de hasta 3 MB. El panel reduce
  imágenes grandes antes de enviarlas.

CONFIGURACIÓN INICIAL
1. Crear un proyecto Supabase en el plan Free y elegir una región cercana
   (South America / São Paulo, si está disponible). No habilitar opciones pagas.
2. En Supabase, abrir SQL Editor y ejecutar
   supabase/migrations/202611090001_gap_agenda.sql.
3. Copiar .env.example a .env.local y completar SUPABASE_URL,
   SUPABASE_SERVICE_ROLE_KEY, GAP_SESSION_SECRET, GAP_ADMIN_USERNAME y
   GAP_ADMIN_PASSWORD. GAP_SESSION_SECRET debe ser un secreto aleatorio largo;
   la contraseña debe tener al menos 12 caracteres con letras y números.
4. Instalar dependencias con npm install y crear el usuario inicial con
   npm run bootstrap:chino. El script no cambia un usuario ya existente.
5. Para preparar los archivos públicos: ejecutar npm run build:netlify. La salida
   queda en dist/ y contiene solo las páginas, scripts del navegador e imágenes.
6. Para desarrollo local con funciones: ejecutar netlify dev. Revisar /,
   /agenda, /chino y las fichas /evento/<slug>.
7. En Netlify, configurar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y
   GAP_SESSION_SECRET como variables privadas en Production y Deploy Previews.
   GAP_ADMIN_USERNAME y GAP_ADMIN_PASSWORD solo se usan en el bootstrap inicial;
   la contraseña se guarda como hash en la base de datos.

PUBLICACIÓN
El sitio se prepara para Netlify. El dominio propio se vinculará cuando esté
comprado. El plan Free tiene un límite mensual de créditos y pausa los sitios al
alcanzarlo, sin recarga automática.

SEGURIDAD Y DATOS
- .env.local, .env.* y .vercel están excluidos de Git; .env.example no tiene
  valores secretos.
- La API pública solo lista eventos publicados y próximos. La edición exige
  sesión y origen del mismo sitio.
- El usuario inicial no se crea hasta configurar el proyecto y ejecutar el
  bootstrap. Guardar la contraseña inicial en un gestor de contraseñas.
- La agenda se ordena primero por fecha y luego por el orden manual para eventos
  de la misma fecha.
- En Free, Supabase puede pausar proyectos con inactividad prolongada y tiene
  cuotas limitadas. No se genera un cargo automático por este código; si se
  supera una cuota, habrá que reducir uso o decidir si se cambia de plan.

DESARROLLO
Node.js 20 o superior recomendado. La carpeta raíz del proyecto es la que
contiene index.html, package.json, netlify.toml y vercel.json.
