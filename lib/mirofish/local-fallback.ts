import type { MiroFishSeedResult } from '@/lib/services/mirofish-client';

function actorsSummary(liveSeed: MiroFishSeedResult): string {
  return liveSeed.entityTypes.slice(0, 8).join(', ');
}

export function localMiroFishAnswer(prompt: string, liveSeed?: MiroFishSeedResult | null): string {
  const lower = prompt.toLowerCase().trim();

  if (lower === 'fish' || lower === 'seafood') {
    return `Fish for your family shop

For fresh fish in Colombo, Negombo and Peliyagoda markets are best early morning (5–8am) for price and freshness.

Skipjack (balaya) — roughly LKR 900–1,400/kg; good for everyday curries and frying.
Red snapper / modha — premium options for special meals.
Prawns (issu) — check lagoon vs sea-caught; spoil fast in monsoon.

Trade-off: Auction route (Peliyagoda) is convenient but middlemen add markup. Direct harbor contracts often save 25–30% and keep fish fresher 2–3 days longer with good cold chain.

Recommendation: For weekly family cooking, buy 2–3 days worth only during monsoon. Ask a follow-up like "auction vs direct boat for skipjack" for a deeper A/B comparison.`;
  }

  if (/hopper/i.test(lower)) {
    return `- **String hoppers** suit lighter weeknight meals with curry or sambol.
- **Plain/egg hoppers** are more filling for a proper family dinner.
- Pick based on how hungry the household is tonight, not habit alone.

Firstly, **string hoppers (idiyappam)** are light rice-noodle nests — pair with pol sambol, dhal, or fish curry for a lighter weeknight.

Secondly, **plain hoppers (appa / egg hoppers)** have a crispy edge and soft centre — more filling, especially with egg and lunu miris.

Recommendation: Light weeknight → string hoppers. Hearty family meal → plain hoppers with egg.`;
  }

  if (/auction|peliyagoda|negombo|harbor|harbour|boat|sourcing|skipjack|tuna|monsoon/i.test(lower)) {
    return `**Seafood sourcing scenario: "${prompt}"**

**Hypothesis A — Auction / middleman (e.g. Peliyagoda)**
Higher price volatility, shorter freshness window, more monsoon road risk.

**Hypothesis B — Direct harbor / boat contract**
Typically lower LKR/kg, longer shelf life, lower carbon from fewer handoffs.

**Recommendation:** Direct harbor sourcing usually wins on price and freshness unless auction prices dip during peak landings. Confirm with today's Negombo or Peliyagoda quotes before committing volume.`;
  }

  if (/rice|keells|cargills|price|budget|shop/i.test(lower)) {
    return `- Keells rice price hikes will push up your weekly shop — plan ahead rather than panic-buying.
- **Compare prices** at Cargills, Arpico, and local pola before the increase hits.
- **Switch varieties** — Nadu or Rathu Kekulu in bulk often beats premium samba on unit cost.
- **Adapt meals** — roti, paan, or manioc 2–3 nights/week reduces rice dependency.

Firstly, **compare prices immediately** at other supermarkets like Cargills or Arpico and check your local pola for bulk deals before the price hike takes effect.

Secondly, consider **switching to a more budget-friendly rice variety** such as Nadu or Rathu Kekulu, or buying in larger quantities (5kg/10kg bags) if you have storage.

Finally, adjust meal planning by incorporating alternative carbohydrates like bread (paan), roti, or manioc to reduce overall rice consumption and stretch your budget.

Recommendation: Compare unit prices across stores this week and buy one bulk bag of Nadu before the hike — avoid overstocking perishables.`;
  }

  if (liveSeed?.entityTypes.length) {
    return `**MiroFish scenario analysis: "${prompt}"**

Mapped **${liveSeed.entityTypes.length} actor types** in the knowledge graph: ${actorsSummary(liveSeed)}.

**How to read this:** These stakeholders shape how your scenario plays out — prices, timing, and risk all flow through their incentives.

**Next step:** Ask a sharper question with a decision, time horizon, and constraint (e.g. budget, weather, headcount) for a more specific recommendation.`;
  }

  return `**Your question:** "${prompt}"

MiroFish is ready to predict this scenario, but the Gemini AI layer is temporarily unavailable (API credits or quota exhausted).

**To restore full AI answers:** add credits or a new key at https://aistudio.google.com and set \`GEMINI_API_KEY\` in your \`.env\` file.

**Meanwhile:** try a more specific prompt — MiroFish works best when you name the decision, audience, and time frame.`;
}
