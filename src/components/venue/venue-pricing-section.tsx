import { CalendarClock, CirclePoundSterling, ExternalLink, UsersRound } from "lucide-react";
import { formatVerifiedDate, getVenuePriceDisplays } from "@/lib/venue-pricing";
import type { VenuePriceOption } from "@/types/venue";

type Props = {
  priceOptions?: VenuePriceOption[];
};

export function VenuePricingSection({ priceOptions }: Props) {
  const prices = getVenuePriceDisplays(priceOptions);

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-6" id="pricing">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9d7b45]">Transparent pricing</p>
      <h2 className="mt-3 font-display text-3xl font-semibold">Wedding prices</h2>
      {prices.length > 0 ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {prices.map((price, index) => {
              const verifiedDate = formatVerifiedDate(price.verifiedAt);
              return (
                <article className="rounded-2xl border border-[var(--line)] bg-[#fffdf9] p-5" key={price.option?.id ?? `legacy-${index}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a806f]">{price.kindLabel}</p>
                  <h3 className="mt-2 text-base font-semibold text-[#3d372f]">{price.label}</h3>
                  <p className="mt-3 font-display text-2xl font-semibold text-[var(--brand)]">{price.amountLabel}</p>
                  {price.description ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{price.description}</p> : null}
                  {price.detailLabels.length > 0 ? (
                    <ul className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
                      {price.detailLabels.map((detail) => (
                        <li className="flex items-center gap-2" key={detail}>
                          {detail.startsWith("Includes") ? <UsersRound aria-hidden size={15} /> : /VAT|tax/i.test(detail) ? <CirclePoundSterling aria-hidden size={15} /> : <CalendarClock aria-hidden size={15} />}
                          {detail}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {verifiedDate || price.sourceUrl ? (
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
                      {verifiedDate ? <span>Checked {verifiedDate}</span> : null}
                      {price.sourceUrl ? (
                        <a className="focus-ring inline-flex items-center gap-1 rounded-md font-semibold text-[#5c6b52] hover:underline" href={price.sourceUrl} target="_blank" rel="noopener noreferrer">
                          View price source <ExternalLink aria-hidden size={13} />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Prices are indicative and may vary by date, guest count and package. Confirm the full quote and inclusions with the venue before booking.</p>
        </>
      ) : (
        <div className="mt-5 rounded-2xl bg-[#fff9ef] p-5">
          <p className="font-semibold text-[#5b4930]">Pricing is being confirmed</p>
          <p className="mt-2 text-sm leading-6 text-[#6a5b42]">Ask the venue for its current hire fees and wedding packages when checking availability.</p>
        </div>
      )}
    </section>
  );
}
