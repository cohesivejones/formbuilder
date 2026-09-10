/** The demo's routes, in nav order. */
export const DEMO_ROUTES = [
  {
    path: "/",
    label: "Full builder",
    summary: "Every capability enabled",
  },
  {
    path: "/locked-down",
    label: "Locked-down form",
    summary: "Wording, order and deletion only",
  },
  {
    path: "/renderer",
    label: "Renderer",
    summary: "Fill in a definition as a real form",
  },
  {
    path: "/conditions",
    label: "Conditional logic",
    summary: "Answers show, hide and require fields",
  },
] as const

export type DemoRoute = (typeof DEMO_ROUTES)[number]
