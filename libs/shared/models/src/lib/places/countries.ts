/** ISO 3166-1 alpha-2 codes: where artists are based and orders ship. */
const CODES = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ
  BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR
  CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU
  ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ
  LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ
  MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF
  PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI
  SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR
  TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`
  .trim()
  .split(/\s+/);

const names = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * Every country by name, keyed by its two-letter code.
 */
export const COUNTRIES = CODES.map((code) => ({
  code,
  name: names.of(code) ?? code,
})).sort((a, b) => a.name.localeCompare(b.name));

const CODE_SET = new Set(CODES);

export function isCountryCode(code: string): boolean {
  return CODE_SET.has(code);
}

/** A country's English name, from its two-letter code. */
export function countryName(code: string): string {
  return names.of(code) ?? code;
}

/** Where an artist is based, as a profile or a search shows it. */
export function placeLabel(
  city: string | null,
  country: string | null,
): string {
  if (!country) return '';
  return city ? `${city}, ${countryName(country)}` : countryName(country);
}
