/* The bracketed panel used across the site. */
export function Frame({ className = "", children, as: As = "div", ...rest }: { className?: string; children: React.ReactNode; as?: "div" | "article" | "section" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={`zf-frame ${className}`} {...rest}>
      <span className="c tl" />
      <span className="c tr" />
      <span className="c bl" />
      <span className="c br" />
      {children}
    </As>
  );
}

export function SectionHead({ index, label }: { index: string; label: string }) {
  return (
    <div className="zf-sechead">
      <b>{index}</b>
      <i>/</i>
      <span>{label}</span>
      <div className="zf-ticks" aria-hidden="true" />
    </div>
  );
}

export function TitleRow({ line1, line2, side, id }: { line1: string; line2?: string; side?: React.ReactNode; id?: string }) {
  return (
    <div className="zf-title-row">
      <h2 className="zf-h2" id={id}>
        {line1}
        {line2 ? <span>{line2}</span> : null}
      </h2>
      {side ? typeof side === "string" ? <p className="zf-lede">{side}</p> : side : null}
    </div>
  );
}

export function PageHero({ title, text, tags, side }: { title: string; text: string; tags?: React.ReactNode; side?: React.ReactNode }) {
  return (
    <>
      <Frame className="zf-pagehero">
        <div className="zf-pagehero-in">
          <div className="min-w-0">
            {tags ? <div className="zf-row" style={{ marginBottom: 18 }}>{tags}</div> : null}
            <h1>{title}</h1>
            <p>{text}</p>
          </div>
          {side}
        </div>
      </Frame>
      <div className="zf-tick-row" aria-hidden="true">
        <div />
        <div />
      </div>
    </>
  );
}
