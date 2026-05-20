import Link from "next/link";

type Breadcrumb = { label: string; href: string };

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm">
      <ol className="flex flex-wrap items-center gap-2 text-[var(--muted)]">
        {items.map((item, index) => (
          <li className="inline-flex items-center gap-2" key={item.href}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {index === items.length - 1 ? (
              <span aria-current="page" className="font-medium text-[#4f4a43]">{item.label}</span>
            ) : (
              <Link className="transition hover:text-[#24211b]" href={item.href}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
