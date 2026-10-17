// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js).
// -----------------------------------------------------------------------------

// Feature names (frozen by Gladys at creation). `{currency}` is filled only
// when Gladys has no unit for the currency of the Homebox group.
export const NAMES = {
  en: {
    items: 'Items',
    locations: 'Locations',
    value: 'Total value',
    warranties: 'Warranties expiring soon',
    overdue: 'Overdue maintenance',
    upcoming: 'Upcoming maintenance',
    next_maintenance: 'Next maintenance',
    next_warranty: 'Next warranty end',
    location_items: 'Items',
    location_value: 'Value',
  },
  fr: {
    items: 'Objets',
    locations: 'Emplacements',
    value: 'Valeur totale',
    warranties: 'Garanties bientôt expirées',
    overdue: 'Entretiens en retard',
    upcoming: 'Entretiens à venir',
    next_maintenance: 'Prochain entretien',
    next_warranty: 'Prochaine fin de garantie',
    location_items: 'Objets',
    location_value: 'Valeur',
  },
  de: {
    items: 'Gegenstände',
    locations: 'Orte',
    value: 'Gesamtwert',
    warranties: 'Bald ablaufende Garantien',
    overdue: 'Überfällige Wartungen',
    upcoming: 'Anstehende Wartungen',
    next_maintenance: 'Nächste Wartung',
    next_warranty: 'Nächstes Garantieende',
    location_items: 'Gegenstände',
    location_value: 'Wert',
  },
  es: {
    items: 'Objetos',
    locations: 'Ubicaciones',
    value: 'Valor total',
    warranties: 'Garantías a punto de vencer',
    overdue: 'Mantenimientos atrasados',
    upcoming: 'Próximos mantenimientos',
    next_maintenance: 'Próximo mantenimiento',
    next_warranty: 'Próximo fin de garantía',
    location_items: 'Objetos',
    location_value: 'Valor',
  },
};

// The text features when there is nothing to show.
export const NONE = { en: 'None', fr: 'Aucun', de: 'Keine', es: 'Ninguno' };

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
  de: 'Die Integration konnte nicht starten: sieh dir ihre Protokolle an.',
  es: 'La integración no pudo iniciarse: consulte sus registros.',
};

// The connection status shown in the Configuration screen.
export const STATUS_TEXT = {
  en: {
    none: 'Enter the address of Homebox.',
    invalid: 'The Homebox address is not valid (http or https, without user name in it).',
    credentials: 'Enter an API key, or the e-mail and password of a Homebox user.',
    unreachable: 'Homebox does not answer: check its address and that it is running.',
    unauthorized: 'Access refused: check the API key, or the e-mail and password.',
    invalid_answer: 'This address does not answer like Homebox (a proxy login page?).',
  },
  fr: {
    none: "Saisissez l'adresse de Homebox.",
    invalid:
      "L'adresse de Homebox n'est pas valide (http ou https, sans nom d'utilisateur dedans).",
    credentials:
      "Saisissez une clé d'API, ou l'e-mail et le mot de passe d'un utilisateur Homebox.",
    unreachable: 'Homebox ne répond pas : vérifiez son adresse et qu’il est démarré.',
    unauthorized: "Accès refusé : vérifiez la clé d'API, ou l'e-mail et le mot de passe.",
    invalid_answer: 'Cette adresse ne répond pas comme Homebox (page de connexion d’un proxy ?).',
  },
  de: {
    none: 'Gib die Adresse von Homebox ein.',
    invalid: 'Die Homebox-Adresse ist ungültig (http oder https, ohne Benutzername darin).',
    credentials: 'Gib einen API-Schlüssel ein, oder E-Mail und Passwort eines Homebox-Benutzers.',
    unreachable: 'Homebox antwortet nicht: prüfe die Adresse und ob es läuft.',
    unauthorized: 'Zugriff verweigert: prüfe den API-Schlüssel, oder E-Mail und Passwort.',
    invalid_answer: 'Diese Adresse antwortet nicht wie Homebox (Anmeldeseite eines Proxys?).',
  },
  es: {
    none: 'Introduzca la dirección de Homebox.',
    invalid: 'La dirección de Homebox no es válida (http o https, sin nombre de usuario).',
    credentials:
      'Introduzca una clave de API, o el correo y la contraseña de un usuario de Homebox.',
    unreachable: 'Homebox no responde: compruebe su dirección y que esté en marcha.',
    unauthorized: 'Acceso denegado: compruebe la clave de API, o el correo y la contraseña.',
    invalid_answer: 'Esta dirección no responde como Homebox (¿página de acceso de un proxy?).',
  },
};

// The "Test the connection" action.
export const TEST_TEXT = {
  en: (version, items, locations) =>
    `Homebox ${version} answers: ${items} item(s) in ${locations} location(s).`,
  fr: (version, items, locations) =>
    `Homebox ${version} répond : ${items} objet(s) dans ${locations} emplacement(s).`,
  de: (version, items, locations) =>
    `Homebox ${version} antwortet. Gegenstände: ${items}, Orte: ${locations}.`,
  es: (version, items, locations) =>
    `Homebox ${version} responde: ${items} objeto(s) en ${locations} ubicación(es).`,
};

// Errors of the scene action.
export const COMMAND_ERRORS = {
  en: {
    name: 'Enter the name of an item.',
    unreachable: 'Homebox does not answer: the inventory could not be read.',
  },
  fr: {
    name: "Saisissez le nom d'un objet.",
    unreachable: "Homebox ne répond pas : l'inventaire n'a pas pu être lu.",
  },
  de: {
    name: 'Gib den Namen eines Gegenstands ein.',
    unreachable: 'Homebox antwortet nicht: das Inventar konnte nicht gelesen werden.',
  },
  es: {
    name: 'Introduzca el nombre de un objeto.',
    unreachable: 'Homebox no responde: no se pudo leer el inventario.',
  },
};

/** { en, fr, de, es } of a coded command error. */
export function commandMessage(code) {
  return Object.fromEntries(
    Object.entries(COMMAND_ERRORS).map(([language, table]) => [language, table[code]]),
  );
}

// The relative day of a warranty end or a maintenance (widget subtitles).
export const WHEN = {
  en: { today: 'Today', in: (n) => `In ${n} day(s)`, late: (n) => `${n} day(s) late` },
  fr: {
    today: "Aujourd'hui",
    in: (n) => `Dans ${n} jour(s)`,
    late: (n) => `${n} jour(s) de retard`,
  },
  de: { today: 'Heute', in: (n) => `In ${n} Tag(en)`, late: (n) => `${n} Tag(e) überfällig` },
  es: { today: 'Hoy', in: (n) => `En ${n} día(s)`, late: (n) => `${n} día(s) de retraso` },
};

export function when(daysLeft, language) {
  const table = WHEN[language] ?? WHEN.en;
  if (daysLeft === 0) {
    return table.today;
  }
  return daysLeft > 0 ? table.in(daysLeft) : table.late(-daysLeft);
}

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** "2026-10-29" -> "29/10/2026" (fr), "29.10.2026" (de)... */
export function formatDay(day, language) {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

// A short symbol for the widget tile unit (6 characters at most).
const SYMBOLS = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' };

export function currencySymbol(code) {
  const upper = String(code ?? '').toUpperCase();
  return SYMBOLS[upper] ?? upper.slice(0, 6);
}
