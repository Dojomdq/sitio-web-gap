import test from 'node:test';
import assert from 'node:assert/strict';
import { publicEvent, slugify, toBuenosAiresIso, validateEventInput } from '../lib/server/events.js';

const validEvent = {
  title: 'Noche de Música',
  artist_name: 'Banda del Puerto',
  category: 'Recital',
  short_description: 'Una fecha para encontrarnos.',
  description: 'Una noche completa de música en GAP.',
  event_date: '2026-11-30T23:30:00.000Z',
  doors_at: '2026-11-30T22:30:00.000Z',
  ends_at: '2026-12-01T03:30:00.000Z',
  venue_name: 'GAP',
  address: 'Av. Constitución 5780, Mar del Plata',
  visitor_info: '',
  ticket_url: 'https://tickets.example.com/gap',
  ticket_provider: 'Ticketera',
  ticket_button_text: 'COMPRAR ENTRADAS',
  ticket_status: 'available',
  publication_status: 'draft',
  display_order: 0,
};

test('slugify normaliza acentos y separadores', () => {
  assert.equal(slugify('Noche de Música — GAP!'), 'noche-de-musica-gap');
});

test('validateEventInput normaliza el evento y no guarda campos ajenos', () => {
  const value = validateEventInput({ ...validEvent, unwanted: 'ignored' });
  assert.equal(value.slug, 'noche-de-musica');
  assert.equal(value.publication_status, 'draft');
  assert.equal('unwanted' in value, false);
});

test('validateEventInput requiere datos completos al crear', () => {
  assert.throws(() => validateEventInput({ ...validEvent, title: ' ' }), /Nombre del evento es obligatorio/);
  assert.throws(() => validateEventInput({ ...validEvent, event_date: '' }), /La fecha del evento es obligatoria/);
});

test('validateEventInput restringe enlaces de entradas a HTTPS sin credenciales', () => {
  assert.throws(() => validateEventInput({ ...validEvent, ticket_url: 'javascript:alert(1)' }), /URL de entradas/);
  assert.throws(() => validateEventInput({ ...validEvent, ticket_url: 'https://user:secret@example.com/buy' }), /no puede incluir credenciales/);
});

test('validateEventInput rechaza fechas incoherentes y estados desconocidos', () => {
  assert.throws(() => validateEventInput({ ...validEvent, ends_at: '2026-11-30T20:00:00.000Z' }), /finalización/);
  assert.throws(() => validateEventInput({ ...validEvent, ticket_status: 'free' }), /estado de venta/);
  assert.throws(() => validateEventInput({ ...validEvent, publication_status: 'public' }), /estado de publicación/);
});

test('partial updates allow untouched required fields but validate supplied ones', () => {
  assert.deepEqual(validateEventInput({ publication_status: 'published' }, { partial: true }), {
    publication_status: 'published',
  });
  assert.throws(() => validateEventInput({ title: '' }, { partial: true }), /Nombre del evento es obligatorio/);
});

test('Argentina local event times convert to UTC at -03:00', () => {
  assert.equal(toBuenosAiresIso('2026-11-30', '20:30'), '2026-11-30T23:30:00.000Z');
});

test('publicEvent returns only public event fields', () => {
  const payload = publicEvent({ ...validEvent, id: 'id', main_image_url: 'https://media.example.com/a.webp', password_hash: 'never', publication_status: 'draft' });
  assert.equal(payload.title, validEvent.title);
  assert.equal('password_hash' in payload, false);
  assert.equal('publication_status' in payload, false);
});
