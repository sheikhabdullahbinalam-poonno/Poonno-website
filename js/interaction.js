// ============================================================================
//  interaction.js — pointer picking for the cab interactives (shelf + poster),
//  active only while the camera is inside the cab. Hover → glow + pointer cursor;
//  click/tap → open the matching modal. Drives the click-guidance: a one-time
//  hint banner and "Tap to explore" labels projected onto each object (§6.5).
// ============================================================================

import * as THREE from 'three';

export function initInteraction({ camera, cab, openModal, isModalOpen, getT }) {
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let hovered = null;

  const inCab = () => { const t = getT(); return t >= 0.10 && t <= 0.30; };

  function pick(cx, cy) {
    ptr.x = (cx / window.innerWidth) * 2 - 1;
    ptr.y = -(cy / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(cab.interactables, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.kind) o = o.parent;
    return o ? o.userData.kind : null;
  }

  function setHover(k) {
    if (k === hovered) return;
    hovered = k;
    cab.setHover(isModalOpen() ? null : k);
    document.body.style.cursor = k ? 'pointer' : '';
  }

  window.addEventListener('mousemove', (e) => {
    if (isModalOpen() || !inCab()) { setHover(null); return; }
    setHover(pick(e.clientX, e.clientY));
  });
  window.addEventListener('click', (e) => {
    if (isModalOpen() || !inCab()) return;
    const k = pick(e.clientX, e.clientY);
    if (k) { openModal(k); markOpened(k); }
  });
  window.addEventListener('touchend', (e) => {
    if (isModalOpen() || !inCab() || !e.changedTouches[0]) return;
    const t = e.changedTouches[0];
    const k = pick(t.clientX, t.clientY);
    if (k) { openModal(k); markOpened(k); }
  }, { passive: true });

  // ---- click-guidance ----
  const hint = document.getElementById('cab-hint');
  const tipShelf = document.getElementById('tip-shelf');
  const tipPoster = document.getElementById('tip-poster');
  const opened = { shelf: false, poster: false };
  let hintShown = false;
  function markOpened(k) {
    opened[k] = true;
    if (k === 'shelf') tipShelf.classList.remove('show');
    if (k === 'poster') tipPoster.classList.remove('show');
  }

  const shelfAnchor = new THREE.Vector3(-1.55, 2.75, -12.6);
  const posterAnchor = new THREE.Vector3(-1.7, 3.05, -15.2);
  const v = new THREE.Vector3();

  function projectTip(anchor, el, show) {
    if (!show) { el.classList.remove('show'); return; }
    v.copy(anchor).project(camera);
    if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { el.classList.remove('show'); return; }
    el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    el.classList.add('show');
  }

  return {
    update() {
      const isIn = inCab();
      if (isIn && !hintShown) {
        hintShown = true;
        hint.classList.add('show');
        setTimeout(() => hint.classList.remove('show'), 5200);
      }
      if (!isIn) hint.classList.remove('show');
      const can = isIn && !isModalOpen();
      projectTip(shelfAnchor, tipShelf, can && !opened.shelf);
      projectTip(posterAnchor, tipPoster, can && !opened.poster);
    },
  };
}
