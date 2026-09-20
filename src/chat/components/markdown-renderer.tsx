'use client';

import React, { useState, useMemo } from 'react';
import { marked, type Tokens, type Token } from 'marked';
import { Copy, Check, ExternalLink, Code } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  onPreviewImage?: (src: string, alt: string) => void;
}

/**
 * Normaliza nombres comunes de lenguajes para mostrar en la barra del bloque de código.
 */
function formatLanguage(lang?: string): string {
  if (!lang) return 'Texto';
  const lower = lang.toLowerCase().trim();
  const map: Record<string, string> = {
    js: 'JavaScript',
    jsx: 'React JSX',
    ts: 'TypeScript',
    tsx: 'React TSX',
    py: 'Python',
    python: 'Python',
    sh: 'Bash',
    bash: 'Bash',
    zsh: 'Zsh',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sql: 'SQL',
    rust: 'Rust',
    go: 'Go',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    cs: 'C#',
    java: 'Java',
    kotlin: 'Kotlin',
    php: 'PHP',
    ruby: 'Ruby',
    swift: 'Swift',
    md: 'Markdown',
    markdown: 'Markdown',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    toml: 'TOML',
    dockerfile: 'Dockerfile',
  };
  return map[lower] || lang.toUpperCase();
}

/**
 * Cierra automáticamente comillas de código triples durante el streaming
 * para evitar que bloques incompletos rompan la estructura visual en vivo.
 */
export function balanceStreamingMarkdown(text: string): string {
  if (!text) return '';
  const codeBlockMatches = text.match(/(?<!\\)```/g);
  const codeBlockCount = codeBlockMatches ? codeBlockMatches.length : 0;
  if (codeBlockCount % 2 !== 0) {
    return text + '\n```';
  }
  return text;
}

/**
 * Componente interactivo para Bloques de Código con cabecera y botón de Copiar.
 */
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar código:', err);
    }
  };

  return (
    <div className="my-2.5 rounded-lg bg-canvas border border-surface-border overflow-hidden shadow-md select-none">
      {/* Barra superior del bloque de código */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface-elevated border-b border-surface-border text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <Code className="w-3.5 h-3.5 text-accent" />
          <span className="font-mono font-medium text-slate-300">{formatLanguage(lang)}</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-surface-hover text-slate-400 hover:text-white transition-colors cursor-pointer text-[11px]"
          title="Copiar código al portapapeles"
        >
          {isCopied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium font-sans">¡Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans">Copiar</span>
            </>
          )}
        </button>
      </div>

      {/* Contenido del código */}
      <pre className="p-3.5 overflow-x-auto font-mono text-[11.5px] text-slate-200 leading-relaxed select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Renderizador recursivo de tokens de Markdown a componentes React nativos.
 */
export function MarkdownRenderer({
  content,
  isStreaming = false,
  onPreviewImage,
}: MarkdownRendererProps) {
  const tokens = useMemo(() => {
    if (!content) return [];
    const textToParse = isStreaming ? balanceStreamingMarkdown(content) : content;
    try {
      return marked.lexer(textToParse, { gfm: true, breaks: true });
    } catch (err) {
      console.error('Error al parsear markdown con marked:', err);
      return [];
    }
  }, [content, isStreaming]);

  if (!content) return null;

  // Renderizar tokens en línea (negritas, cursivas, enlaces, inline code, etc.)
  const renderInlineTokens = (inlineTokens?: Token[]): React.ReactNode => {
    if (!inlineTokens || inlineTokens.length === 0) return null;

    return inlineTokens.map((t, idx) => {
      switch (t.type) {
        case 'text': {
          const textToken = t as Tokens.Text;
          if (textToken.tokens && textToken.tokens.length > 0) {
            return <React.Fragment key={idx}>{renderInlineTokens(textToken.tokens)}</React.Fragment>;
          }
          return <span key={idx}>{t.text}</span>;
        }

        case 'paragraph':
          return (
            <React.Fragment key={idx}>
              {renderInlineTokens((t as Tokens.Paragraph).tokens)}
            </React.Fragment>
          );

        case 'strong':
          return (
            <strong key={idx} className="font-bold text-white">
              {renderInlineTokens(t.tokens)}
            </strong>
          );

        case 'em':
          return (
            <em key={idx} className="italic text-slate-200">
              {renderInlineTokens(t.tokens)}
            </em>
          );

        case 'codespan':
          return (
            <code
              key={idx}
              className="px-1.5 py-0.5 mx-0.5 rounded bg-surface-elevated text-amber-300 font-mono text-[11px] border border-surface-border select-text"
            >
              {t.text}
            </code>
          );

        case 'del':
          return (
            <del key={idx} className="line-through text-slate-400">
              {renderInlineTokens(t.tokens)}
            </del>
          );

        case 'link':
          return (
            <a
              key={idx}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline underline-offset-2 break-all transition-colors inline-flex items-center gap-0.5"
              title={t.title || t.href}
            >
              <span>{renderInlineTokens(t.tokens) || t.text}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70 shrink-0 inline" />
            </a>
          );

        case 'image':
          return (
            <img
              key={idx}
              src={t.href}
              alt={t.text}
              title={t.title || t.text}
              className="max-h-72 max-w-full rounded-lg object-contain bg-black/40 border border-surface-border cursor-pointer hover:opacity-95 transition-opacity my-2 shadow-md"
              onClick={() => onPreviewImage?.(t.href, t.text || 'imagen_markdown.png')}
            />
          );

        case 'br':
          return <br key={idx} />;

        case 'escape':
          return <span key={idx}>{t.text}</span>;

        default:
          return <span key={idx}>{(t as { text?: string }).text || ''}</span>;
      }
    });
  };

  // Renderizar bloques principales de nivel superior
  const renderBlockToken = (token: Token, index: number): React.ReactNode => {
    switch (token.type) {
      case 'space':
        return null;

      case 'code':
        return <CodeBlock key={index} code={token.text} lang={token.lang} />;

      case 'heading': {
        const depth = token.depth;
        const inlineNodes = renderInlineTokens(token.tokens);
        if (depth === 1) {
          return (
            <h1 key={index} className="text-base font-bold text-white mt-4 mb-2 first:mt-0 leading-snug font-sans">
              {inlineNodes}
            </h1>
          );
        }
        if (depth === 2) {
          return (
            <h2 key={index} className="text-sm font-bold text-white mt-3.5 mb-1.5 first:mt-0 leading-snug font-sans">
              {inlineNodes}
            </h2>
          );
        }
        if (depth === 3) {
          return (
            <h3 key={index} className="text-xs font-bold text-slate-100 mt-3 mb-1 first:mt-0 leading-snug font-sans">
              {inlineNodes}
            </h3>
          );
        }
        return (
          <h4 key={index} className="text-xs font-semibold text-slate-200 mt-2.5 mb-1 first:mt-0 leading-snug font-sans">
            {inlineNodes}
          </h4>
        );
      }

      case 'paragraph':
        return (
          <p key={index} className="text-xs text-slate-200 leading-relaxed my-1.5 break-words font-sans">
            {renderInlineTokens(token.tokens)}
          </p>
        );

      case 'list': {
        const listToken = token as Tokens.List;
        const isOrdered = listToken.ordered;
        const ListTag = isOrdered ? 'ol' : 'ul';
        return (
          <ListTag
            key={index}
            start={typeof listToken.start === 'number' ? listToken.start : 1}
            className={`my-2 pl-5 text-xs text-slate-200 space-y-1 leading-relaxed font-sans ${
              isOrdered ? 'list-decimal' : 'list-disc'
            }`}
          >
            {listToken.items.map((item: Tokens.ListItem, itemIdx: number) => (
              <li key={itemIdx} className="break-words">
                {item.tokens && item.tokens.length > 0 ? (
                  item.tokens.map((subToken, subIdx) => {
                    if (subToken.type === 'list') {
                      return renderBlockToken(subToken, subIdx);
                    }
                    if (subToken.type === 'text') {
                      const textSubToken = subToken as Tokens.Text;
                      return textSubToken.tokens && textSubToken.tokens.length > 0 ? (
                        <React.Fragment key={subIdx}>
                          {renderInlineTokens(textSubToken.tokens)}
                        </React.Fragment>
                      ) : (
                        <span key={subIdx}>{textSubToken.text}</span>
                      );
                    }
                    if (subToken.type === 'paragraph') {
                      return (
                        <span key={subIdx}>
                          {renderInlineTokens((subToken as Tokens.Paragraph).tokens)}
                        </span>
                      );
                    }
                    return (
                      <React.Fragment key={subIdx}>
                        {renderInlineTokens([subToken])}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <span>{item.text}</span>
                )}
              </li>
            ))}
          </ListTag>
        );
      }

      case 'blockquote': {
        const quoteToken = token as Tokens.Blockquote;
        return (
          <blockquote
            key={index}
            className="border-l-2 border-accent/70 pl-3.5 py-1.5 my-2.5 bg-accent/10 text-slate-300 italic rounded-r-md text-xs leading-relaxed font-sans"
          >
            {quoteToken.tokens?.map((t: Token, idx: number) => renderBlockToken(t, idx))}
          </blockquote>
        );
      }

      case 'table': {
        const tableToken = token as Tokens.Table;
        return (
          <div key={index} className="overflow-x-auto my-3 rounded-lg border border-surface-border shadow-sm select-text">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-elevated border-b border-surface-border">
                  {tableToken.header.map((cell: Tokens.TableCell, cellIdx: number) => (
                    <th
                      key={cellIdx}
                      style={{ textAlign: tableToken.align[cellIdx] || undefined }}
                      className="px-3 py-2 font-semibold text-slate-200 text-xs whitespace-nowrap font-sans"
                    >
                      {renderInlineTokens(cell.tokens)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-surface/60">
                {tableToken.rows.map((row: Tokens.TableCell[], rowIdx: number) => (
                  <tr key={rowIdx} className="hover:bg-white/[0.03] transition-colors">
                    {row.map((cell: Tokens.TableCell, cellIdx: number) => (
                      <td
                        key={cellIdx}
                        style={{ textAlign: tableToken.align[cellIdx] || undefined }}
                        className="px-3 py-2 text-slate-300 text-xs font-sans"
                      >
                        {renderInlineTokens(cell.tokens)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'hr':
        return <hr key={index} className="my-3 border-surface-border" />;

      default:
        return (
          <div key={index} className="text-xs text-slate-200 leading-relaxed my-1">
            {renderInlineTokens((token as { tokens?: Token[] }).tokens) || (token as { text?: string }).text}
          </div>
        );
    }
  };

  return (
    <div className="font-sans text-xs leading-relaxed select-text space-y-0.5">
      {tokens.map((token, index) => renderBlockToken(token, index))}
    </div>
  );
}
