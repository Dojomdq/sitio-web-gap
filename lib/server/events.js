const TICKET_STATUSES = new Set(['available', 'sold_out', 'coming_soon']);
const PUBLICATION_STATUSES = new Set(['draft', 'published', 'hidden']);

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function text(value, field, { required = false, max = 3000 } = {}) {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) invalid(`${field} es obligatorio.`);
  if (normalized.length > max) invalid(`${field} supera el largo permitido.`);
  return normalized;
}

function optionalDate(value, field) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) invalid(`${field} no es una fecha válida.`);
  return date.toISOString();
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function validateEventInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Revisá los datos del evento.');
  const value = {};
  const fields = [
    ['title', 'Nombre del evento', true, 160],
    ['artist_name', 'Artista o responsable', true, 160],
    ['category', 'Categoría', true, 80],
    ['short_description', 'Descripción breve', true, 360],
    ['description', 'Descripción completa', true, 10000],
    ['venue_name', 'Espacio', true, 160],
    ['address', 'Dirección', true, 240],
    ['visitor_info', 'Información para visitantes', false, 1200],
    ['ticket_provider', 'Ticketera', false, 120],
    ['ticket_button_text', 'Texto del botón', true, 60],
    ['main_image_path', 'Imagen principal', false, 512],
  ];

  for (const [key, label, required, max] of fields) {
    if (partial && !(key in input)) continue;
    value[key] = text(input[key], label, { required, max });
  }
  if (value.main_image_path && !/^events\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(value.main_image_path)) {
    invalid('La ruta de la imagen principal no es válida.');
  }

  if (!partial || 'event_date' in input) {
    value.event_date = optionalDate(input.event_date, 'Fecha del evento');
    if (!value.event_date) invalid('La fecha del evento es obligatoria.');
  }
  if ('doors_at' in input || !partial) value.doors_at = optionalDate(input.doors_at, 'Apertura de puertas');
  if ('ends_at' in input || !partial) value.ends_at = optionalDate(input.ends_at, 'Finalización');

  if (value.ends_at && value.event_date && Date.parse(value.ends_at) < Date.parse(value.event_date)) {
    invalid('La finalización no puede ser anterior al inicio.');
  }
  if (value.doors_at && value.event_date && Date.parse(value.doors_at) > Date.parse(value.event_date)) {
    invalid('La apertura de puertas no puede ser posterior al inicio.');
  }

  if (!partial || 'ticket_url' in input) {
    value.ticket_url = text(input.ticket_url, 'URL de entradas', { max: 2048 }) || null;
    if (value.ticket_url) {
      let url;
      try { url = new URL(value.ticket_url); } catch { invalid('La URL de entradas no es válida.'); }
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) invalid('La URL de entradas debe usar HTTPS y no puede incluir credenciales.');
    }
  }

  if (!partial || 'ticket_status' in input) {
    value.ticket_status = text(input.ticket_status || 'coming_soon', 'Estado de venta', { max: 24 });
    if (!TICKET_STATUSES.has(value.ticket_status)) invalid('El estado de venta no es válido.');
  }
  if (!partial || 'publication_status' in input) {
    value.publication_status = text(input.publication_status || 'draft', 'Estado de publicación', { max: 24 });
    if (!PUBLICATION_STATUSES.has(value.publication_status)) invalid('El estado de publicación no es válido.');
  }

  if (!partial || 'display_order' in input) {
    const order = Number(input.display_order ?? 0);
    if (!Number.isInteger(order) || order < 0 || order > 100000) invalid('El orden no es válido.');
    value.display_order = order;
  }

  if (!partial || 'slug' in input || 'title' in input) value.slug = slugify(input.slug || input.title || '');
  if (!value.slug && !partial) invalid('El nombre del evento debe incluir letras o números.');
  return value;
}

export function publicEvent(event, gallery = []) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    artist_name: event.artist_name,
    category: event.category,
    main_image_url: event.main_image_url || null,
    short_description: event.short_description,
    description: event.description,
    event_date: event.event_date,
    doors_at: event.doors_at,
    ends_at: event.ends_at,
    venue_name: event.venue_name,
    address: event.address,
    visitor_info: event.visitor_info,
    ticket_url: event.ticket_url,
    ticket_provider: event.ticket_provider,
    ticket_button_text: event.ticket_button_text,
    ticket_status: event.ticket_status,
    gallery,
  };
}

export function toBuenosAiresIso(date, time) {
  if (!date) return null;
  const clock = time || '00:00';
  const value = new Date(`${date}T${clock}:00-03:00`);
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}
