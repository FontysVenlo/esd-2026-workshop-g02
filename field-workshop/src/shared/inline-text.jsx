import React from 'react';

// Page JSON supports bold text, code, and links inside a complete sentence.
// Render these as React nodes so JSON content never becomes raw HTML.
export function InlineText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\x60[^\x60]+\x60|\[[^\]]+\]\([^\s)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('\x60') && part.endsWith('\x60')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
    if (link && /^(https?:\/\/|\/(?!\/))/.test(link[2])) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noopener">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}
