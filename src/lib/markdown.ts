import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

// Permitir solo subset basico, sin HTML inline crudo del usuario.
// Sanitizacion mas estricta podria llegar despues con DOMPurify si subimos el riesgo.
export function renderMarkdown(input: string): string {
  if (!input) return "";
  // Escape de < y > antes del parse para prevenir inyeccion de HTML crudo.
  // marked seguira procesando syntax markdown pero no aceptara <script> ni <img onerror>.
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return marked.parse(escaped) as string;
}
