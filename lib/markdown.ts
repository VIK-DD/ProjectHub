// A tiny, dependency-free markdown -> HTML renderer. It deliberately supports a
// pragmatic subset (headings, bold/italic, inline + fenced code, links, lists,
// blockquotes, hr, paragraphs). Input is HTML-escaped first, so it's safe to
// render the result with dangerouslySetInnerHTML for a single user's own notes.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text: string): string {
  let s = text;
  // inline code (protect from other rules)
  s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // italic
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_\s][^_]*)_/g, "$1<em>$2</em>");
  // images — only http/https (handled before links so they don't collide)
  s = s.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy" />',
  );
  // links — only http/https
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return s;
}

export function renderMarkdown(source: string): string {
  if (!source?.trim()) return "";
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  let i = 0;
  let taskIndex = 0; // running index of `- [ ]` items across the document
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line.trim())) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        code.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing fence
      out.push(`<pre><code>${code.join("\n")}</code></pre>`);
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push("<hr />");
      i++;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(inline(escapeHtml(lines[i].replace(/^>\s?/, ""))));
        i++;
      }
      out.push(`<blockquote>${quote.join("<br />")}</blockquote>`);
      continue;
    }

    // Unordered list (with GitHub-style task items)
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      let hasTask = false;
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^[-*]\s+/, "");
        const task = /^\[( |x|X)\]\s+(.*)$/.exec(raw);
        if (task) {
          hasTask = true;
          const checked = task[1].toLowerCase() === "x";
          const idx = taskIndex++;
          items.push(
            `<li class="task-list-item"><input type="checkbox" data-task-index="${idx}"${checked ? " checked" : ""}/><span${checked ? ' class="task-done"' : ""}>${inline(escapeHtml(task[2]))}</span></li>`,
          );
        } else {
          items.push(`<li>${inline(escapeHtml(raw))}</li>`);
        }
        i++;
      }
      out.push(`<ul${hasTask ? ' class="task-list"' : ""}>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(
          `<li>${inline(escapeHtml(lines[i].replace(/^\d+\.\s+/, "")))}</li>`,
        );
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Paragraph (consume consecutive plain lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|>\s?|[-*]\s+|\d+\.\s+|```)/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      para.push(inline(escapeHtml(lines[i])));
      i++;
    }
    out.push(`<p>${para.join("<br />")}</p>`);
  }

  return out.join("\n");
}

/**
 * Flip the Nth markdown task marker (`- [ ]` ⇄ `- [x]`) in the source. Used to
 * make rendered checkboxes interactive while keeping markdown the source of
 * truth.
 */
export function toggleTaskMarker(source: string, index: number): string {
  let i = -1;
  return source.replace(
    /^(\s*[-*]\s+)\[( |x|X)\]/gm,
    (match, prefix: string, mark: string) => {
      i += 1;
      if (i !== index) return match;
      return `${prefix}[${mark === " " ? "x" : " "}]`;
    },
  );
}
