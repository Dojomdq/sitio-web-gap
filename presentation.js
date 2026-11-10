const host = document.querySelector('#presentation-gallery');
const caption = document.querySelector('#presentation-caption');

async function loadPresentation() {
  if (!host) return;
  try {
    const response = await fetch('/api/presentation', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return;
    const { images = [] } = await response.json();
    const photos = images.filter((image) => image?.url).slice(0, 3);
    if (!photos.length) return;
    const placements = ['main', 'singer', 'theatre'];
    const fragment = document.createDocumentFragment();
    photos.forEach((photo, index) => {
      const link = document.createElement('a');
      link.className = `live-photo ${placements[index]} fade`;
      link.href = '/agenda';
      link.setAttribute('aria-label', 'Ver la agenda de GAP');
      const image = document.createElement('img');
      image.src = photo.url;
      image.alt = `GAP en vivo, foto ${index + 1}`;
      image.loading = index === 0 ? 'eager' : 'lazy';
      link.append(image);
      fragment.append(link);
    });
    host.dataset.count = String(photos.length);
    host.replaceChildren(fragment);
    host.hidden = false;
    if (caption) caption.hidden = false;
  } catch {
    // The presentation is optional; a temporary API issue leaves the section clean.
  }
}

loadPresentation();
