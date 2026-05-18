/* ════════════════════════════════════════════════════════════
   Pepe — the IberoFuel pig assistant
   A floating mascot in the bottom-left with contextual speech bubbles.
   ════════════════════════════════════════════════════════════ */

const Pepe = (function() {
  let bubbleTimeout = null;
  let queue = [];
  let isMuted = false;
  let bubbleVisible = false;
  let firstUserAction = false;

  const TIPS = [
    { text: 'Si pulsas <b>Ubicarme</b> te enseño las gasolineras más baratas a 15 km 📍', mood: 'happy' },
    { text: 'Toca el chip de combustible para cambiar (95, 98, Gasóleo…) ⛽', mood: 'idle' },
    { text: 'La tarjeta marcada con corona es <b>la más barata</b> de la zona 🏆', mood: 'happy' },
    { text: 'Regístrate gratis para guardar favoritas y recibir alertas 🔔', mood: 'idle' },
    { text: 'Pulsa <b>Ordenar → Distancia</b> si tienes prisa por repostar 🚗', mood: 'idle' },
    { text: '¿Sabías que el precio cambia cada día? Yo lo vigilo por ti 🐽', mood: 'happy' },
  ];

  function $bubble() { return document.getElementById('pepe-bubble'); }
  function $body()   { return document.getElementById('pepe-body'); }
  function $char()   { return document.getElementById('pepe-char'); }

  function setMood(mood) {
    const el = $char();
    if (!el) return;
    el.classList.remove('mood-idle','mood-happy','mood-thinking','mood-talking');
    el.classList.add('mood-' + (mood || 'idle'));
  }

  function show(text, mood, duration = 5000) {
    const b = $bubble();
    if (!b) return;
    if (isMuted) return;
    if (bubbleTimeout) { clearTimeout(bubbleTimeout); bubbleTimeout = null; }

    $body().innerHTML = text;
    b.classList.add('open');
    bubbleVisible = true;
    setMood(mood || 'talking');

    // duration < 0 means sticky (no auto-hide)
    if (duration > 0) {
      bubbleTimeout = setTimeout(() => { hide(); }, duration);
    }
  }

  function hide() {
    const b = $bubble();
    if (!b) return;
    if (bubbleTimeout) { clearTimeout(bubbleTimeout); bubbleTimeout = null; }
    b.classList.remove('open');
    bubbleVisible = false;
    setMood('idle');
  }

  function greet() {
    show(
      `¡Hola! Soy <b>Pepe</b> 🐽<br>Pulsa <b>Ubicarme</b> o elige tu provincia y te enseño las gasolineras más baratas cerca de ti.`,
      'happy',
      -1 // sticky — stays until user closes
    );
  }

  function randomTip() {
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    show(tip.text, tip.mood, 5500);
  }

  function bind() {
    const char = $char();
    if (!char) return;
    char.addEventListener('click', () => {
      if (bubbleVisible) {
        hide();
      } else {
        randomTip();
      }
    });
    // Idle bobbing already in CSS; trigger a "wave" on hover
    char.addEventListener('mouseenter', () => {
      if (!bubbleVisible) setMood('happy');
    });
    char.addEventListener('mouseleave', () => {
      if (!bubbleVisible) setMood('idle');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    setTimeout(bind, 0);
  }

  return {
    say: show,
    hide,
    greet,
    tip: randomTip,
    mute: () => { isMuted = true; hide(); },
    unmute: () => { isMuted = false; }
  };
})();

window.Pepe = Pepe;
