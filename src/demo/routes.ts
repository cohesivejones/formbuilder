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
] as const

export type DemoRoute = (typeof DEMO_ROUTES)[number]
