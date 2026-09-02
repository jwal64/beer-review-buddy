// The categorical style palette, one colour per beer style. Kept identical to
// `sC` in public/stats/data.js so a Pilsner reads the same amber here as it
// does on the stats site. Categorical data colour is the one place a literal
// belongs outside the theme tokens — there is no semantic token for "Stout".
const STYLE_COLORS: Record<string, string> = {
  Lager: "#e9a23b",
  Pilsner: "#d4bd52",
  "Wheat Beer": "#e8c98e",
  "Belgian Ale": "#9b87e8",
  IPA: "#e07a4c",
  "Pale Ale": "#8ab861",
  Stout: "#9c7a5f",
  "Brown Ale": "#c19472",
  "Red Ale": "#d96a6a",
  "Shandy / Radler": "#dcd363",
};

export function styleColor(style?: string | null) {
  return (style && STYLE_COLORS[style]) || "#8aa0c0";
}
