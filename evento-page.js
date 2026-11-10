const root = document.getElementById('event-detail');
const zone = 'America/Argentina/Buenos_Aires';
const dateFmt = (value) => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: zone }).format(new Date(value));
const timeFmt = (value) => value ? `${new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(value))} HS` : 'A confirmar';
const node = (tag, cls, text) => { const item = document.createElement(tag); if (cls) item.className = cls; if (text != null) item.textContent = text; return item; };

function fact(label, value) {
  const item = node('div');
  item.append(node('small', '', label), node('strong', '', value || 'A confirmar'));
  return item;
}

function showError(message) {
  const box = node('section', 'error');
  box.append(node('h1', '', 'NO ENCONTRAMOS ESE EVENTO.'), node('p', '', message));
  const back = node('a', '', 'Volver a la agenda'); back.href = '/agenda';
  box.append(back);
  root.replaceChildren(box);
}

async function loadEvent() {
  const pathSlug = decodeURIComponent(location.pathname.split('/').filter(Boolean).at(-1) || '');
  const slug = new URLSearchParams(location.search).get('slug') || (pathSlug === 'evento' || pathSlug === 'evento.html' ? '' : pathSlug);
  if (!slug) return showError('El enlace no contiene un evento válido.');
  try {
    const response = await fetch(`/api/events?slug=${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const event = await response.json();
    if (!response.ok) return showError(event.error || 'El evento ya no está disponible.');

    const page = node('article', 'detail');
    const hero = node('div', 'hero-img');
    if (event.main_image_url) {
      const image = node('img'); image.src = event.main_image_url; image.alt = `${event.title} en GAP`; image.fetchPriority = 'high';
      hero.append(image);
    }
    hero.append(node('span', 'tag', event.category || 'GAP'));

    const info = node('div', 'info');
    info.append(node('div', 'kicker', event.category || 'Agenda GAP'));
    info.append(node('h1', '', event.title), node('p', 'artist', event.artist_name));
    info.append(node('p', 'description', event.description || event.short_description));
    const facts = node('div', 'facts');
    facts.append(
      fact('FECHA', `${dateFmt(event.event_date)} · ${timeFmt(event.event_date)}`),
      fact('APERTURA DE PUERTAS', timeFmt(event.doors_at)),
      fact('LUGAR', event.venue_name),
      fact('DIRECCIÓN', event.address),
      fact('FINALIZACIÓN', timeFmt(event.ends_at)),
      fact('INFORMACIÓN', event.visitor_info || 'Consultá cualquier duda con GAP.'),
    );
    info.append(facts);
    if (event.ticket_status === 'sold_out') {
      info.append(node('span', 'ticket', 'ENTRADAS AGOTADAS'));
      info.append(node('span', 'notice', 'Este espectáculo está agotado.'));
    } else if (event.ticket_status === 'available' && event.ticket_url) {
      const ticket = node('a', 'ticket', event.ticket_button_text || 'COMPRAR ENTRADAS');
      ticket.href = event.ticket_url; ticket.target = '_blank'; ticket.rel = 'noopener noreferrer';
      ticket.append(node('span', '', '↗'));
      info.append(ticket);
      if (event.ticket_provider) info.append(node('span', 'notice', `Venta online · ${event.ticket_provider}`));
    } else {
      const ticket = node('span', 'ticket', event.ticket_button_text || 'ENTRADAS PRÓXIMAMENTE');
      ticket.setAttribute('aria-disabled', 'true');
      info.append(ticket);
    }
    if (event.visitor_info) info.append(node('p', 'notice', event.visitor_info));
    page.append(hero, info);

    if (event.gallery?.length) {
      const gallery = node('div', 'gallery');
      for (const item of event.gallery) {
        const image = node('img'); image.src = item.url; image.alt = item.alt_text || `${event.title} · imagen de galería`; image.loading = 'lazy'; image.decoding = 'async';
        gallery.append(image);
      }
      page.append(gallery);
    }
    document.title = `${event.title} — GAP Mar del Plata`;
    root.replaceChildren(page);
  } catch {
    showError('No pudimos cargar la información. Probá nuevamente en unos minutos.');
  }
}

loadEvent();
