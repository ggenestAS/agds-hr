import { marked } from "marked";
import { useState } from "react";

import policyRaw from "../../content/articles/performance-evaluation-and-compensation-policy.md?raw";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";

// The Performance Evaluation and Compensation Policy, rendered from the
// versioned Markdown source in content/articles/. Parsed once at module scope
// — the article ships with the route chunk, no server round-trip. Collapsed by
// default so the dashboard stays an overview.

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

const frontmatter = FRONTMATTER.exec(policyRaw)?.[1] ?? "";
const metaField = (key: string): string | undefined =>
  new RegExp(`^${key}:\\s*"?([^"\\n]+)"?$`, "m").exec(frontmatter)?.[1];

const TITLE = metaField("title") ?? "Performance Evaluation and Compensation Policy";
const OWNER = metaField("owner");
const LAST_REVIEWED = metaField("last_reviewed");
const STATUS = metaField("status");

// The card title carries the document title, so drop the leading h1 from the
// body along with the frontmatter.
const body = policyRaw.replace(FRONTMATTER, "").replace(/^# .*\n/m, "");
const html = marked.parse(body, { async: false });

const PROSE =
  "[&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight " +
  "[&_h3]:mt-6 [&_h3]:text-[15px] [&_h3]:font-bold " +
  "[&_h4]:mt-4 [&_h4]:text-sm [&_h4]:font-bold " +
  "[&_p]:mt-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink-700 " +
  "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_li]:mt-1.5 [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-ink-700 " +
  "[&_blockquote]:mt-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-accent)] " +
  "[&_blockquote]:pl-3.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground " +
  "[&_strong]:font-semibold [&_strong]:text-foreground";

export function PolicyArticle() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <CardTitle>{TITLE}</CardTitle>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-sm font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dk)]"
          >
            {open ? "Collapse" : "Read the policy →"}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          How Albert evaluates performance, sets compensation, and manages promotions — the rules
          this whole cycle runs on.
          {OWNER !== undefined && ` Owned by ${OWNER}.`}
          {LAST_REVIEWED !== undefined && ` Last reviewed ${LAST_REVIEWED}`}
          {STATUS !== undefined && ` · ${STATUS}`}
          {(LAST_REVIEWED !== undefined || STATUS !== undefined) && "."}
        </p>
      </CardHeader>
      {open && (
        <CardContent>
          {/* Trusted content: our own versioned Markdown file, not user input. */}
          <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
        </CardContent>
      )}
    </Card>
  );
}
