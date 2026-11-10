const container = document.getElementById('event-grid');
const zone = 'America/Argentina/Buenos_Aires';
const fmtDate = (value) => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: zone }).format(new Date(value));
const fmtTime = (value) => value ? `${new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(value))} HS` : 'A confirmar';

function card(event) {
  const link = document.createElement('a');
  link.className = 'event';
  link.href = `/evento/${encodeURIComponent(event.slug)}`;
  const imageBox = document.createElement('div');
  imageBox.className = 'event-img';
  if (event.main_image_url) {
    const img = document.createElement('img');
    img.src = event.main_image_url;
    img.alt = `${event.title} en GAP`;
    img.loading = 'lazy';
    img.decoding = 'async';
    imageBox.append(img);
  }
  const info = document.createElement('div');
  info.className = 'event-info';
  const category = document.createElement('small'); category.textContent = event.category || 'AGENDA GAP';
  const title = document.createElement('h2'); title.textContent = event.title;
  const artist = document.createElement('p'); artist.textContent = event.artist_name;
  const date = document.createElement('div'); date.className = 'date'; date.textContent = `${fmtDate(event.event_date)} · ${fmtTime(event.event_date)}`;
  const description = document.createElement('p'); description.textContent = event.short_description;
  info.append(category, title, artist, date, description);
  link.append(imageBox, info);
  return link;
}

try {
  const response = await fetch('/api/events', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo cargar la agenda.');
  container.replaceChildren();
  if (!payload.events?.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No hay próximas fechas publicadas. Muy pronto, nuevas noches para vivir en GAP.';
    container.append(empty);
  } else {
    container.append(...payload.events.map(card));
  }
} catch {
  const error = document.createElement('p'); error.className = 'error'; error.textContent = 'No pudimos cargar la agenda. Probá nuevamente en unos minutos.';
  container.replaceChildren(error);
}
