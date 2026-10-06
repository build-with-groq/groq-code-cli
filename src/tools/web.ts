import type { ToolDefinition, ToolResult } from '../types.js';

/**
 * Web search and page-fetch tools.
 * Uses DuckDuckGo's HTML endpoint for keyless search and node's fetch for pages.
 * No external dependencies.
 */

const DDG_ENDPOINT = 'https://html.duckduckgo.com/html/?q=';

/** Decode HTML entities without DOM/lib. */
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/** Naive, tag-aware HTML-to-text that keeps link text. */
function htmlToText(html: string): string {
  let text = html
    // Script/style blocks to nothing
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Block tags -> newlines
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    // Remaining tags stripped
    .replace(/<[^>]+>/g, ' ');
  text = decodeHtml(text);
  // Collapse blank lines
  return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
}

async function duckSearch(query: string, maxResults = 5): Promise<{ title: string; snippet: string; url: string }[]> {
  const url = DDG_ENDPOINT + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (agent-cli web search)', accept: 'text/html' },
  });
  const html = await res.text();

  const results: { title: string; snippet: string; url: string }[] = [];
  // Result blocks in DDG html are: <a class="result__a" href="...">Title</a>
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links: { url: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && links.length < maxResults) {
    let href = m[1];
    // DDG redirect URL -> extract uddg param
    try {
      const u = new URL(href, 'https://duckduckgo.com');
      const uddg = u.searchParams.get('uddg');
      if (uddg) href = uddg;
    } catch { /* keep as-is */ }
    links.push({ url: href, title: decodeHtml(m[2].trim()) });
  }

  const snippets: string[] = [];
  while ((m = snippetRe.exec(html)) && snippets.length < maxResults) {
    snippets.push(decodeHtml(m[1].trim()));
  }

  for (let i = 0; i < links.length; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    });
  }
  return results;
}

async function webSearch(args: Record<string, any>): Promise<ToolResult> {
  const query = String(args.query || '');
  const max = args.max_results ? Number(args.max_results) : 5;
  try {
    const results = await duckSearch(query, Math.min(max, 10));
    return { success: true, content: results, message: `${results.length} results` };
  } catch (e: any) {
    return { success: false, error: `Web search failed: ${e.message}` };
  }
}

async function webFetch(args: Record<string, any>): Promise<ToolResult> {
  const url = String(args.url || '');
  if (!/^https?:\/\//.test(url)) return { success: false, error: 'URL must start with http(s)://' };
  const maxChars = args.max_chars ? Number(args.max_chars) : 8000;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'agent-cli/1.0' } });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    const trimmed = text.length > maxChars ? text.slice(0, maxChars) + '\n...[truncated]' : text;
    return { success: true, content: contentType.includes('text/html') ? htmlToText(trimmed) : trimmed, message: `Fetched ${url}` };
  } catch (e: any) {
    return { success: false, error: `Fetch failed: ${e.message}` };
  }
}

export const WEB_TOOLS: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Search the web and return a list of result titles, URLs, and snippets. Use when you need up-to-date information, docs, or answers not in the repo.',
    permission: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'integer', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
    run: webSearch,
  },
  {
    name: 'web_fetch',
    description: 'Fetch a URL and return its text content. Use to read a specific page found by web_search.',
    permission: 'read',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full http(s) URL' },
        max_chars: { type: 'integer', description: 'Max characters to return (default 8000)' },
      },
      required: ['url'],
    },
    run: webFetch,
  },
];