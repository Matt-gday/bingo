// The regulars' faces. Each is a coloured circle with eyes and a mouth that change with their mood, drawn in
// code, so a new regular only needs a colour. Moods: content, smug, shocked, sulky, cheer.

const INK = '#2b1b6b';

const FEATURES = {
  content: `
    <ellipse cx="33" cy="44" rx="6" ry="8" fill="${INK}"/><ellipse cx="67" cy="44" rx="6" ry="8" fill="${INK}"/>
    <ellipse cx="31" cy="41" rx="2" ry="2.6" fill="#fff"/><ellipse cx="65" cy="41" rx="2" ry="2.6" fill="#fff"/>
    <path d="M33 62 Q50 76 67 62" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  smug: `
    <ellipse cx="33" cy="46" rx="6" ry="7" fill="${INK}"/><ellipse cx="67" cy="46" rx="6" ry="7" fill="${INK}"/>
    <path d="M24 42 Q33 36 42 42 L42 38 Q33 31 24 38 Z" fill="COLOUR"/><path d="M58 42 Q67 36 76 42 L76 38 Q67 31 58 38 Z" fill="COLOUR"/>
    <path d="M24 42 Q33 37 42 42" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M58 42 Q67 37 76 42" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M32 65 Q54 78 72 58" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  shocked: `
    <ellipse cx="33" cy="42" rx="8" ry="11" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="67" cy="42" rx="8" ry="11" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="33" cy="44" r="3.6" fill="${INK}"/><circle cx="67" cy="44" r="3.6" fill="${INK}"/>
    <ellipse cx="50" cy="71" rx="7.5" ry="10" fill="${INK}"/>`,
  sulky: `
    <ellipse cx="33" cy="49" rx="5.5" ry="6.5" fill="${INK}"/><ellipse cx="67" cy="49" rx="5.5" ry="6.5" fill="${INK}"/>
    <path d="M24 36 L42 42" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M76 36 L58 42" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M35 72 Q50 60 65 72" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  cheer: `
    <path d="M22 48 Q33 34 44 48" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" fill="none"/><path d="M56 48 Q67 34 78 48" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" fill="none"/>
    <path d="M28 58 Q50 92 72 58 Z" fill="${INK}"/><path d="M38 72 Q50 82 62 72 Q50 66 38 72 Z" fill="#ff7f95"/>`,
};

export function faceSvg(colour, mood = 'content', size = 48) {
  const features = (FEATURES[mood] ?? FEATURES.content).replaceAll('COLOUR', colour);
  return `<svg class="face face-${mood}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><radialGradient id="g-${mood}-${colour.slice(1)}" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="${colour}"/><stop offset="1" stop-color="${colour}"/></radialGradient></defs>
    <circle cx="50" cy="50" r="47" fill="url(#g-${mood}-${colour.slice(1)})"/>
    <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(43,27,107,.18)" stroke-width="2"/>
    <ellipse cx="18" cy="60" rx="8" ry="5" fill="#ff8fb8" opacity=".55"/><ellipse cx="82" cy="60" rx="8" ry="5" fill="#ff8fb8" opacity=".55"/>
    ${features}
  </svg>`;
}

// The player's own face on the table screens: the same drawing in the player's colour.
export const YOU_COLOUR = '#9fb4ff';
