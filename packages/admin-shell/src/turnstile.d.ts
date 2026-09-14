export const minimumFlexibleWidth: 300;
export function responsiveTurnstileSize(container: {
  getBoundingClientRect?: () => { width: number };
  clientWidth?: number;
} | null | undefined): "flexible" | "compact";
