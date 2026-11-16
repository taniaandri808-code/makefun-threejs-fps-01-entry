// The look plan, in one place. Six values and one accent hue; the lighting makes every
// shade the game needs, so no other colour appears in the code. The same six names are
// the CSS custom properties in index.html.
// Brightened for map readability: warm daylight concrete look.
export const PALETTE = {
  canvas: '#9d968a',   // bright concrete floor / sky base
  surface: '#c8c1b2',  // sunlit wall plaster
  hairline: '#7e766a', // crates & cover (mid tone)
  ink: '#eef2ff',      // bright directional light
  muted: '#cfd8e4',    // cool fill light
  accent: '#ff9d1b',   // orange accent
};

export function shade(name) {
  return PALETTE[name];
}
