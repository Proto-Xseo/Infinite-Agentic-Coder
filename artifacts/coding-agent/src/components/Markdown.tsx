import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown text-[14px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return <p className="mb-3 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="mb-3 mt-4 text-xl font-semibold">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mb-2 mt-4 text-lg font-semibold">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mb-2 mt-3 text-base font-semibold">{children}</h3>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-2 hover:underline"
              >
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-3 border-l-2 border-accent/60 pl-3 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-4 border-border" />;
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border-b border-border bg-card/60 px-3 py-1.5 font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border-b border-border/60 px-3 py-1.5">{children}</td>;
          },
          code(props) {
            const { className, children, ...rest } = props as {
              className?: string;
              children?: React.ReactNode;
              inline?: boolean;
            };
            const inline = (props as { inline?: boolean }).inline;
            const text = String(children ?? "").replace(/\n$/, "");
            const match = /language-(\w+)/.exec(className ?? "");
            if (inline || !match) {
              return (
                <code
                  className="rounded bg-secondary/70 px-1 py-0.5 font-mono text-[12.5px] text-foreground"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match[1]} value={text} />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-[#0b0b0d]">
      <div className="flex items-center justify-between border-b border-border bg-card/40 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="hover-elevate flex items-center gap-1 rounded px-1.5 py-0.5 normal-case text-muted-foreground"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark as { [key: string]: React.CSSProperties }}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "12px 14px",
          background: "transparent",
          fontSize: "12.5px",
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
