export const EL_BG = ['#dcfce7', '#fee2e2', '#fef9c3', '#f4f4f5', '#dbeafe']
export const EL_TEXT = ['#166534', '#991b1b', '#854d0e', '#3f3f46', '#1e3a8a']
export const EL_BORDER = ['#86efac', '#fca5a5', '#fde047', '#a1a1aa', '#93c5fd']
export const EL_BAR = ['#22c55e', '#ef4444', '#eab308', '#a1a1aa', '#3b82f6']

export const EL_BG_DARK = ['#14532d', '#450a0a', '#422006', '#27272a', '#172554']
export const EL_TEXT_DARK = ['#86efac', '#fca5a5', '#fde047', '#d4d4d8', '#93c5fd']
export const EL_BORDER_DARK = ['#166534', '#991b1b', '#854d0e', '#3f3f46', '#1e3a8a']

export function getElBg(el: number, dark: boolean) {
  return dark ? EL_BG_DARK[el] : EL_BG[el]
}

export function getElText(el: number, dark: boolean) {
  return dark ? EL_TEXT_DARK[el] : EL_TEXT[el]
}

export function getElBorder(el: number, dark: boolean) {
  return dark ? EL_BORDER_DARK[el] : EL_BORDER[el]
}
