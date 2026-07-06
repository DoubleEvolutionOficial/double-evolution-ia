import { PropsWithChildren } from "react";

type PanelProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export function Panel({ title, subtitle, children }: PanelProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="panel-content">{children}</div>
    </section>
  );
}