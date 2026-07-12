import type { MiroFishConfidenceSignal } from '@/lib/types';

function signal(
  metric: string,
  value: number,
  ciLower: number,
  ciUpper: number,
  unit: string,
  interpretation: string
): MiroFishConfidenceSignal {
  return { metric, value, ciLower, ciUpper, unit, interpretation };
}

export function localMiroFishConfidenceSignals(prompt: string): MiroFishConfidenceSignal[] {
  const lower = prompt.toLowerCase();

  if (/rice|keells|cargills|price|budget|shop/i.test(lower)) {
    return [
      signal(
        'Weekly grocery bill change',
        12,
        8,
        18,
        '%',
        'Expected increase in total weekly shop if staple rice prices rise ~15%.'
      ),
      signal(
        'Bulk Nadu savings vs premium samba',
        850,
        620,
        1100,
        'LKR',
        'Estimated monthly savings switching to bulk Nadu rice for a family of 4.'
      ),
      signal(
        'Price-hike avoidance (pre-buy)',
        72,
        58,
        84,
        '%',
        'Probability a one-time bulk purchase before the hike beats reactive weekly buys.'
      ),
      signal(
        'Meal-plan adaptation benefit',
        9,
        5,
        14,
        '%',
        'Additional budget relief from substituting rice with roti/paan 2–3 nights per week.'
      ),
    ];
  }

  if (/hopper/i.test(lower)) {
    return [
      signal(
        'Family satisfaction (plain hoppers)',
        82,
        71,
        91,
        '%',
        'Likelihood plain/egg hoppers feel filling enough for a family dinner.'
      ),
      signal(
        'Family satisfaction (string hoppers)',
        68,
        55,
        79,
        '%',
        'Likelihood string hoppers satisfy when paired with curry and sambol.'
      ),
      signal(
        'Prep time difference',
        25,
        18,
        35,
        'min',
        'Extra prep time for plain hoppers vs string hoppers on a weeknight.'
      ),
    ];
  }

  if (/auction|peliyagoda|negombo|harbor|harbour|boat|skipjack|tuna|monsoon/i.test(lower)) {
    return [
      signal(
        'Price per kg — auction route',
        1380,
        1180,
        1620,
        'LKR/kg',
        'Expected landed cost via Peliyagoda auction with middleman markup.'
      ),
      signal(
        'Price per kg — direct boat',
        980,
        820,
        1150,
        'LKR/kg',
        'Expected cost via direct harbor/boat contract during monsoon season.'
      ),
      signal(
        'Shelf life at home',
        4.5,
        3,
        6,
        'days',
        'Days fish stays fresh with cold chain — direct route typically longer.'
      ),
      signal(
        'Direct route wins on cost',
        78,
        65,
        88,
        '%',
        'Probability direct sourcing beats auction on price + freshness combined.'
      ),
    ];
  }

  return [
    signal(
      'Recommendation confidence',
      74,
      62,
      85,
      '%',
      'Model confidence that the top recommendation holds under typical Sri Lankan market conditions.'
    ),
    signal(
      'Scenario volatility',
      28,
      18,
      40,
      '%',
      'How much outcomes may swing if prices, weather, or supply shift in the next 2 weeks.'
    ),
    signal(
      'Actionable within 7 days',
      88,
      76,
      95,
      '%',
        'Probability you can act on this advice immediately without extra research.'
    ),
  ];
}
