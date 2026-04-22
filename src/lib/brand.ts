export const brand = {
  name: "SeaRiders",
  adminName: "SeaRiders Admin",
  description: "Panel operativo y de administracion de SeaRiders para tienda, plataforma, carpa y flota.",
  colors: {
    primary: "#0b2239",
    secondary: "#0f766e",
    success: "#166534",
    warning: "#b45309",
    danger: "#b91c1c",
    info: "#1d4ed8",
    ink: "#142033",
    muted: "#5a6c84",
    surface: "#ffffff",
    surfaceSoft: "#eef4fb",
    border: "#d9e2ec",
  },
  gradients: {
    appBackground:
      "radial-gradient(circle at top left, rgba(15, 118, 110, 0.08), transparent 24%), radial-gradient(circle at top right, rgba(11, 34, 57, 0.08), transparent 28%), linear-gradient(180deg, #f8fbfd 0%, #f2f6fb 100%)",
    hero:
      "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 30%), radial-gradient(circle at right bottom, rgba(45, 212, 191, 0.14), transparent 28%), linear-gradient(135deg, #0b2239 0%, #0f766e 56%, #12344d 100%)",
    publicHero:
      "radial-gradient(circle at top left, rgba(56, 189, 248, 0.14), transparent 28%), radial-gradient(circle at right top, rgba(20, 184, 166, 0.1), transparent 24%), linear-gradient(180deg, #f8fbfd 0%, #edf4fa 100%)",
  },
} as const;

export type BrandColorName = keyof typeof brand.colors;
