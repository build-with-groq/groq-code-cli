export interface MarkdownElement {
  type: 'text' | 'code-block' | 'heading' | 'mixed-line';
  content: string;
  level?: number;
}

export interface InlineElement {
  type: 'text' | 'code' | 'bold' | 'italic';
  content: string;
}

export function parseMarkdown(content: string): MarkdownElement[] {
  const lines = content.split('\n');
  const elements: MarkdownElement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle code blocks
    if (line.startsWith('```')) {
      const codeBlocks: string[] = [];
      i++; // Skip opening ```
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeBlocks.push(lines[i]);
        i++;
      }
      elements.push({
        type: 'code-block',
        content: codeBlocks.join('\n')
      });
      continue;
    }
    
    // Handle headings
    if (line.startsWith('#')) {
      const level = line.match(/^#{1,6}/)?.[0].length || 1;
      const text = line.replace(/^#{1,6}\s*/, '');
      elements.push({
        type: 'heading',
        content: text,
        level
      });
      continue;
    }
    
    // Handle mixed content lines (with inline code, bold, italic)
    // Check for mixed content, but exclude list items
    const isListItem = /^[\s]*[-*+]\s/.test(line);
    if (!isListItem && (line.includes('`') || line.includes('**') || (line.includes('*') && !line.includes('**')))) {
      elements.push({
        type: 'mixed-line',
        content: line
      });
      continue;
    }
    
    // Regular text
    elements.push({
      type: 'text',
      content: line || ' '
    });
  }
  
  return elements;
}

export function parseInlineElements(content: string): InlineElement[] {
  const elements: InlineElement[] = [];
  let remaining = content;
  
  while (remaining.length > 0) {
    // Check for inline code first (highest priority)
    const codeMatch = remaining.match(/^(.*?)(`[^`]+`)(.*)/);
    if (codeMatch) {
      // Add text before code if any (but don't recurse to avoid infinite loops)
      if (codeMatch[1]) {
        elements.push({
          type: 'text',
          content: codeMatch[1]
        });
      }
      // Add code element
      elements.push({
        type: 'code',
        content: codeMatch[2].slice(1, -1) // Remove backticks
      });
      remaining = codeMatch[3];
      continue;
    }
    
    // Check for bold
    const boldMatch = remaining.match(/^(.*?)(\*\*[^*]+\*\*)(.*)/);
    if (boldMatch) {
      // Add text before bold if any (but don't recurse to avoid infinite loops)
      if (boldMatch[1]) {
        elements.push({
          type: 'text',
          content: boldMatch[1]
        });
      }
      // Add bold element
      elements.push({
        type: 'bold',
        content: boldMatch[2].slice(2, -2) // Remove **
      });
      remaining = boldMatch[3];
      continue;
    }
    
    // Check for italic
    const italicMatch = remaining.match(/^(.*?)(\*[^*]+\*)(.*)/);
    if (italicMatch) {
      // Add text before italic if any (but don't recurse to avoid infinite loops)
      if (italicMatch[1]) {
        elements.push({
          type: 'text',
          content: italicMatch[1]
        });
      }
      // Add italic element
      elements.push({
        type: 'italic',
        content: italicMatch[2].slice(1, -1) // Remove *
      });
      remaining = italicMatch[3];
      continue;
    }
    
    // No more markdown found, add remaining as text
    elements.push({
      type: 'text',
      content: remaining
    });
    break;
  }
  
  return elements;
}