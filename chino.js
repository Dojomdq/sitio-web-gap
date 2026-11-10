const $ = (selector) => document.querySelector(selector);
const loginScreen = $('#login-screen');
const dashboardScreen = $('#dashboard-screen');
const editor = $('#event-editor');
const eventForm = $('#event-form');
const list = $('#event-list');
const passwordDialog = $('#password-dialog');
const TIME_ZONE = 'America/Argentina/Buenos_Aires';
let events = [];
let saving = false;

function message(element, text = '', type = '') {
  element.textContent = text;
  element.className = `message${type ? ` ${type}` : ''}`;
}

function showScreen(authenticated) {
  if (!authenticated && passwordDialog.open) passwordDialog.close();
  loginScreen.hidden = authenticated;
  dashboardScreen.hidden = !authenticated;
  loginScreen.classList.toggle('active', !authenticated);
  dashboardScreen.classList.toggle('active', authenticated);
  $('#logout-button').hidden = !authenticated;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: { Accept: 'application/json', ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/login') {
      showScreen(false);
      $('#login-password').value = '';
    }
    throw new Error(data.error || 'No se pudo completar la solicitud.');
  }
  return data;
}

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null) item.textContent = text;
  return item;
}

function localParts(value) {
  if (!value) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

function argentinaIso(date, time) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00-03:00`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function displayDate(value) {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE }).format(new Date(value));
}

function displayTime(value) {
  if (!value) return 'Horario a confirmar';
  return `${new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE }).format(new Date(value))} HS`;
}

function stateLabel(status) {
  return { published: 'Publicado', draft: 'Borrador', hidden: 'Oculto' }[status] || status;
}

function renderList() {
  const filter = $('#event-filter').value;
  const visible = events.filter((event) => filter === 'all' || event.publication_status === filter);
  $('#event-count').textContent = `${events.length} ${events.length === 1 ? 'evento cargado' : 'eventos cargados'}`;
  if (!visible.length) {
    const empty = node('p', 'empty-state', events.length ? 'No hay eventos con ese filtro.' : 'Todavía no hay eventos. Creá el primero para empezar a armar la agenda.');
    list.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const event of visible) {
    const row = node('article', 'event-row');
    const thumb = node('img', 'event-thumb');
    thumb.alt = '';
    if (event.main_image_url) { thumb.src = event.main_image_url; thumb.loading = 'lazy'; }
    row.append(thumb);

    const copy = node('div', 'event-copy');
    copy.append(node('h2', '', event.title), node('p', '', `${event.artist_name} · ${displayDate(event.event_date)} · ${displayTime(event.event_date)}`));
    const badges = node('div', 'badges');
    badges.append(node('span', `badge ${event.publication_status}`, stateLabel(event.publication_status)));
    badges.append(node('span', 'badge', event.ticket_status === 'sold_out' ? 'Agotado' : event.ticket_status === 'available' ? 'Entradas disponibles' : 'Venta próxima'));
    copy.append(badges);
    row.append(copy);

    const actions = node('div', 'row-actions');
    const index = events.findIndex((item) => item.id === event.id);
    const previous = events[index - 1];
    const next = events[index + 1];
    const canMoveUp = previous && localParts(previous.event_date).date === localParts(event.event_date).date;
    const canMoveDown = next && localParts(next.event_date).date === localParts(event.event_date).date;
    const up = node('button', '', '↑'); up.type = 'button'; up.title = 'Subir dentro de la misma fecha'; up.setAttribute('aria-label', `Subir ${event.title}`); up.disabled = !canMoveUp; up.addEventListener('click', () => reorder(index, index - 1));
    const down = node('button', '', '↓'); down.type = 'button'; down.title = 'Bajar dentro de la misma fecha'; down.setAttribute('aria-label', `Bajar ${event.title}`); down.disabled = !canMoveDown; down.addEventListener('click', () => reorder(index, index + 1));
    const edit = node('button', '', 'Editar'); edit.type = 'button'; edit.addEventListener('click', () => openEditor(event));
    const remove = node('button', '', 'Eliminar'); remove.type = 'button'; remove.classList.add('delete'); remove.addEventListener('click', () => deleteEvent(event));
    actions.append(up, down, edit, remove);
    row.append(actions);
    fragment.append(row);
  }
  list.replaceChildren(fragment);
}

async function loadEvents() {
  list.replaceChildren(node('p', 'empty-state', 'Cargando eventos…'));
  try {
    const data = await api('/api/gestion/events');
    events = (data.events || []).sort((a, b) => Date.parse(a.event_date) - Date.parse(b.event_date) || (a.display_order || 0) - (b.display_order || 0));
    renderList();
  } catch (error) {
    message($('#dashboard-message'), error.message, 'error');
    list.replaceChildren(node('p', 'empty-state', 'No pudimos cargar los eventos. Recargá la página para volver a intentar.'));
  }
}

function setFormValue(id, value) { $(`#${id}`).value = value ?? ''; }

function showCurrentImages(event) {
  const mainHost = $('#main-image-current');
  mainHost.replaceChildren();
  if (event?.main_image_url) {
    const item = node('div', 'image-item');
    const img = node('img'); img.src = event.main_image_url; img.alt = 'Imagen principal actual';
    item.append(img, node('span', 'help', 'Imagen actual'));
    mainHost.append(item);
  }
  const gallery = $('#gallery-current');
  gallery.replaceChildren();
  for (const photo of event?.gallery || []) {
    const item = node('div', 'image-item');
    const img = node('img'); img.src = photo.image_url; img.alt = photo.alt_text || 'Foto de galería';
    const remove = node('button', '', 'Quitar'); remove.type = 'button'; remove.addEventListener('click', async () => {
      if (!window.confirm('¿Querés quitar esta imagen de la galería?')) return;
      try { await api(`/api/gestion/gallery?id=${encodeURIComponent(photo.id)}`, { method: 'DELETE' }); await reloadOpenEvent(); }
      catch (error) { message($('#form-message'), error.message, 'error'); }
    });
    item.append(img, remove);
    gallery.append(item);
  }
}

let editingId = null;
async function reloadOpenEvent() {
  await loadEvents();
  if (!editingId) return;
  const event = events.find((item) => item.id === editingId);
  if (event) showCurrentImages(event);
}

function openEditor(event = null) {
  editingId = event?.id || null;
  eventForm.reset();
  setFormValue('event-id', event?.id || '');
  setFormValue('main-image-path', event?.main_image_path || '');
  setFormValue('event-title', event?.title || '');
  setFormValue('event-artist', event?.artist_name || '');
  setFormValue('event-category', event?.category || 'Show');
  setFormValue('event-order', event?.display_order ?? 0);
  setFormValue('event-short', event?.short_description || '');
  setFormValue('event-description', event?.description || '');
  const start = localParts(event?.event_date);
  const doors = localParts(event?.doors_at);
  const end = localParts(event?.ends_at);
  setFormValue('event-date', start.date);
  setFormValue('event-start', start.time);
  setFormValue('event-doors', doors.time);
  setFormValue('event-end', end.time);
  setFormValue('event-venue', event?.venue_name || 'GAP');
  setFormValue('event-address', event?.address || 'Av. Constitución 5780, Mar del Plata');
  setFormValue('event-visitor-info', event?.visitor_info || '');
  setFormValue('ticket-url', event?.ticket_url || '');
  setFormValue('ticket-provider', event?.ticket_provider || '');
  setFormValue('ticket-button', event?.ticket_button_text || 'COMPRAR ENTRADAS');
  setFormValue('ticket-status', event?.ticket_status || 'coming_soon');
  setFormValue('publication-status', event?.publication_status || 'draft');
  $('#editor-title').textContent = event ? 'EDITAR EVENTO' : 'NUEVO EVENTO';
  message($('#form-message'));
  showCurrentImages(event);
  editor.hidden = false;
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor() {
  editor.hidden = true;
  eventForm.reset();
  editingId = null;
}

function makePayload() {
  const date = $('#event-date').value;
  const start = argentinaIso(date, $('#event-start').value);
  if (!start) throw new Error('Completá la fecha y la hora de inicio.');
  const doorsTime = $('#event-doors').value;
  const endTime = $('#event-end').value;
  return {
    title: $('#event-title').value.trim(),
    artist_name: $('#event-artist').value.trim(),
    category: $('#event-category').value.trim(),
    short_description: $('#event-short').value.trim(),
    description: $('#event-description').value.trim(),
    event_date: start,
    doors_at: doorsTime ? argentinaIso(date, doorsTime) : null,
    ends_at: endTime ? argentinaIso(date, endTime) : null,
    venue_name: $('#event-venue').value.trim(),
    address: $('#event-address').value.trim(),
    visitor_info: $('#event-visitor-info').value.trim(),
    ticket_url: $('#ticket-url').value.trim() || null,
    ticket_provider: $('#ticket-provider').value.trim(),
    ticket_button_text: $('#ticket-button').value.trim() || 'COMPRAR ENTRADAS',
    ticket_status: $('#ticket-status').value,
    publication_status: $('#publication-status').value,
    display_order: Number($('#event-order').value || 0),
    main_image_path: $('#main-image-path').value || null,
  };
}

async function optimizeImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen.');
  if (file.size > 25 * 1024 * 1024) throw new Error('La imagen original supera 25 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.84;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  while (blob && blob.size > 2.8 * 1024 * 1024 && quality > 0.55) {
    quality -= 0.1;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  }
  if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('No se pudo reducir la imagen a menos de 3 MB.');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'gap'}.webp`, { type: 'image/webp' });
}

async function uploadImage(file, eventId, purpose) {
  const optimized = await optimizeImage(file);
  const form = new FormData();
  form.append('event_id', eventId);
  form.append('purpose', purpose);
  form.append('image', optimized, optimized.name);
  const result = await api('/api/gestion/upload', { method: 'POST', body: form });
  if (purpose === 'main') setFormValue('main-image-path', result.path);
}

async function saveEvent(event) {
  if (saving) return;
  saving = true;
  const button = $('#save-event');
  button.disabled = true;
  message($('#form-message'), 'Guardando…');
  try {
    const payload = makePayload();
    let eventId = editingId;
    if (eventId) {
      await api(`/api/gestion/event?id=${encodeURIComponent(eventId)}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      const created = await api('/api/gestion/events', { method: 'POST', body: JSON.stringify(payload) });
      eventId = created.event.id;
      editingId = eventId;
      setFormValue('event-id', eventId);
    }

    const mainFile = $('#main-image').files[0];
    const galleryFiles = Array.from($('#gallery-images').files);
    if (mainFile) await uploadImage(mainFile, eventId, 'main');
    for (const file of galleryFiles) await uploadImage(file, eventId, 'gallery');
    $('#main-image').value = '';
    $('#gallery-images').value = '';
    message($('#form-message'), 'Evento guardado. La agenda pública se actualizó.', 'ok');
    await loadEvents();
    const saved = events.find((item) => item.id === eventId);
    if (saved) showCurrentImages(saved);
    if (!mainFile && galleryFiles.length === 0) setTimeout(() => { if (editor.hidden === false) closeEditor(); }, 700);
  } catch (error) {
    message($('#form-message'), error.message, 'error');
  } finally {
    saving = false;
    button.disabled = false;
  }
}

async function deleteEvent(event) {
  const answer = window.confirm(`¿Eliminar “${event.title}” y sus imágenes? Esta acción no se puede deshacer.`);
  if (!answer) return;
  try {
    await api(`/api/gestion/event?id=${encodeURIComponent(event.id)}`, { method: 'DELETE' });
    message($('#dashboard-message'), 'Evento eliminado.', 'ok');
    if (editingId === event.id) closeEditor();
    await loadEvents();
  } catch (error) {
    message($('#dashboard-message'), error.message, 'error');
  }
}

async function reorder(from, to) {
  const a = events[from]; const b = events[to];
  if (!a || !b || localParts(a.event_date).date !== localParts(b.event_date).date) return;
  const next = [...events];
  [next[from], next[to]] = [next[to], next[from]];
  try {
    await api('/api/gestion/reorder', { method: 'POST', body: JSON.stringify({ ids: next.map((event) => event.id) }) });
    events = next.map((event, index) => ({ ...event, display_order: index }));
    renderList();
  } catch (error) { message($('#dashboard-message'), error.message, 'error'); }
}

async function verifySession() {
  try {
    const session = await api('/api/auth/session');
    showScreen(true);
    $('#welcome-text').textContent = `Sesión de ${session.username}. Gestioná fechas, entradas e imágenes.`;
    await loadEvents();
  } catch {
    showScreen(false);
  }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  message($('#login-message'), 'Verificando acceso…');
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: $('#login-username').value, password: $('#login-password').value }) });
    $('#login-password').value = '';
    showScreen(true);
    $('#welcome-text').textContent = `Sesión de ${data.username}. Gestioná fechas, entradas e imágenes.`;
    await loadEvents();
  } catch (error) {
    const text = error.message === 'Usuario o contraseña incorrectos.'
      ? 'El navegador puede haber completado una contraseña anterior. Ingresala manualmente y volvé a intentar.'
      : error.message;
    $('#login-password').value = '';
    $('#login-password').focus();
    message($('#login-message'), text, 'error');
  }
  finally { button.disabled = false; }
});

$('#logout-button').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); }
  catch { /* The session cookie is cleared below even if the session expired. */ }
  showScreen(false);
  $('#login-password').value = '';
});

$('#new-event-button').addEventListener('click', () => openEditor());
$('#close-editor').addEventListener('click', closeEditor);
$('#event-form').addEventListener('submit', (event) => { event.preventDefault(); saveEvent(event); });
$('#event-filter').addEventListener('change', renderList);

$('#open-password-dialog').addEventListener('click', () => {
  $('#password-form').reset();
  message($('#password-message'));
  passwordDialog.showModal();
  $('#current-password').focus();
});
$('#close-password-dialog').addEventListener('click', () => passwordDialog.close());
passwordDialog.addEventListener('click', (event) => {
  if (event.target === passwordDialog) passwordDialog.close();
});

$('#password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const newPassword = $('#new-password').value;
  if (newPassword !== $('#confirm-password').value) return message($('#password-message'), 'Las contraseñas nuevas no coinciden.', 'error');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  message($('#password-message'), 'Actualizando…');
  try {
    await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: $('#current-password').value, new_password: newPassword }) });
    passwordDialog.close();
    $('#password-form').reset();
    showScreen(false);
    message($('#login-message'), 'Contraseña actualizada. Ingresá nuevamente con la nueva contraseña.', 'ok');
  } catch (error) {
    message($('#password-message'), error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

verifySession();
