/**
 * IANA timezones per seeded country, keyed by ISO 3166-1 alpha-2 code.
 * RF-19: the tournament form only offers the zones valid for the
 * selected country. Countries without an explicit mapping fall back
 * to UTC so the field never ends up without valid options.
 */
const COUNTRY_TIMEZONES: Record<string, string[]> = {
  US: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
  ],
  CA: [
    'America/St_Johns',
    'America/Halifax',
    'America/Toronto',
    'America/Winnipeg',
    'America/Edmonton',
    'America/Vancouver',
  ],
  MX: [
    'America/Tijuana',
    'America/Hermosillo',
    'America/Chihuahua',
    'America/Mazatlan',
    'America/Mexico_City',
    'America/Cancun',
  ],
  BR: [
    'America/Rio_Branco',
    'America/Manaus',
    'America/Belem',
    'America/Sao_Paulo',
    'America/Noronha',
  ],
  CO: ['America/Bogota'],
  AR: ['America/Argentina/Buenos_Aires'],
  CL: ['Pacific/Easter', 'America/Santiago'],
  PE: ['America/Lima'],
  ES: ['Atlantic/Canary', 'Europe/Madrid'],
  FR: ['Europe/Paris'],
  DE: ['Europe/Berlin'],
  GB: ['Europe/London'],
  IT: ['Europe/Rome'],
  JP: ['Asia/Tokyo'],
  KR: ['Asia/Seoul'],
  AU: [
    'Australia/Perth',
    'Australia/Darwin',
    'Australia/Brisbane',
    'Australia/Adelaide',
    'Australia/Sydney',
    'Australia/Hobart',
  ],
};

export function timezonesForCountryCode(code: string | null | undefined): string[] {
  if (!code) return [];
  return COUNTRY_TIMEZONES[code.toUpperCase()] ?? ['UTC'];
}

export function timezoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ');
}
