const BA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function dateLabel(value, options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('es-AR', { ...options, timeZone: BA_TIME_ZONE }).format(new Date(value));
}

function timeLabel(value) {
  if (!value) return 'A confirmar';
  return `${new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: BA_TIME_ZONE }).format(new Date(value))} HS`;
}

function detailLink(event) {
  return `/evento/${encodeURIComponent(event.slug)}`;
}

function fact(label, value) {
  const box = el('div');
  box.append(el('small', '', label));
  box.append(el('strong', '', value || 'A confirmar'));
  return box;
}

function makeFeatured(event) {
  const card = document.getElementById('agenda-feature');
  card.replaceChildren();
  card.classList.add('visible');
  card.hidden = false;

  const imageBox = el('div', 'featured-show-image');
  if (event.main_image_url) {
    const image = el('img');
    image.src = event.main_image_url;
    image.alt = `${event.title} en GAP`;
    image.loading = 'lazy';
    image.decoding = 'async';
    imageBox.append(image);
  } else {
    imageBox.classList.add('featured-show-image-empty');
    imageBox.append(el('span', '', 'GAP'));
  }
  imageBox.append(el('span', 'image-tag', event.category || 'EVENTO'));

  const info = el('div', 'featured-show-info');
  const overline = el('div', 'show-overline');
  overline.append(el('span', '', event.category || 'SHOW EN GAP'));
  overline.append(el('span', 'demo-tag', 'PRÓXIMA FECHA'));
  info.append(overline);

  const title = el('h3');
  title.append(document.createTextNode(event.title));
  title.append(document.createElement('br'));
  const artist = el('em', '', event.artist_name);
  title.append(artist);
  info.append(title, el('p', 'show-description', event.short_description));

  const facts = el('div', 'show-facts');
  facts.append(
    fact('FECHA', `${dateLabel(event.event_date)} · ${timeLabel(event.event_date)}`),
    fact('APERTURA DE PUERTAS', timeLabel(event.doors_at)),
    fact('LUGAR', `${event.venue_name} · ${event.address}`),
    fact('ENTRADAS', event.ticket_provider || (event.ticket_status === 'sold_out' ? 'AGOTADO' : 'VENTA PRÓXIMAMENTE')),
  );
  info.append(facts);

  const actions = el('div', 'show-actions');
  const link = el('a', 'show-cta', 'VER EVENTO');
  link.href = detailLink(event);
  link.dataset.cursor = 'VER';
  link.append(el('span', '', ' ↗'));
  actions.append(link, el('span', 'show-footnote', event.ticket_status === 'sold_out' ? 'Entradas agotadas.' : 'Toda la información del evento y sus entradas.'));
  info.append(actions);
  card.append(imageBox, info);
}

function makePreview(event) {
  const link = el('a', 'up-next-item');
  link.href = detailLink(event);
  link.setAttribute('aria-label', `Ver ${event.title}`);
  if (event.main_image_url) {
    const image = el('img');
    image.src = event.main_image_url;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    link.append(image);
  } else {
    link.append(el('div', 'up-next-placeholder', 'GAP'));
  }
  const content = el('div');
  content.append(
    el('small', '', `${event.category || 'AGENDA GAP'} · ${dateLabel(event.event_date, { day: 'numeric', month: 'short' })}`),
    el('strong', '', event.title),
    el('span', '', event.artist_name),
  );
  link.append(content);
  return link;
}

async function loadAgenda() {
  const status = document.getElementById('agenda-status');
  const empty = document.getElementById('agenda-empty');
  const preview = document.getElementById('agenda-preview');
  const more = document.getElementById('agenda-more');
  try {
    const response = await fetch('/api/events', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo cargar la agenda.');
    const events = payload.events || [];
    status.hidden = true;
    if (!events.length) {
      empty.hidden = false;
      return;
    }
    makeFeatured(events[0]);
    preview.replaceChildren(...events.slice(1, 3).map(makePreview));
    preview.hidden = events.length < 2;
    more.hidden = events.length <= 3;
  } catch {
    status.textContent = 'No pudimos cargar las próximas fechas. Probá nuevamente en unos minutos.';
  }
}

loadAgenda();
