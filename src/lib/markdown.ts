import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

const URL_RE = /(?<![\(=])(https?:\/\/[^\s<]+[^\s<.,:;!?)\]])/g;
const MENTION_RE = /(?<![\w/])@([a-zA-ZÀ-ÿ0-9_.-]{2,40})/g;

export function renderMarkdown(input: string): string {
  if (!input) return "";

  // Escape HTML crudo
  let safe = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Auto-link URLs sueltas
  safe = safe.replace(URL_RE, (url) => `<${url}>`);

  // Parse markdown
  let html = marked.parse(safe) as string;

  // Forzar target=_blank y rel seguro en todos los <a>
  html = html.replace(/<a\s+href="([^"]*)"([^>]*)>/g, (_m, href, rest) => {
    if (!/^(https?:|mailto:)/i.test(href)) return `<a href="#"${rest}>`;
    if (/target=/.test(rest)) return `<a href="${href}"${rest}>`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer"${rest}>`;
  });

  // Resaltar @menciones
  html = html.replace(
    MENTION_RE,
    (_m, name) =>
      `<span class="mention text-[#ffcd07] font-semibold">@${name}</span>`,
  );

  return html;
}
