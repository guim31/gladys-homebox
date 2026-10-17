// -----------------------------------------------------------------------------
// The "Home inventory" dashboard widget: four tiles (items, total value,
// warranties ending soon, maintenance due) and the list of what comes next —
// maintenance overdue or upcoming, warranties ending — the soonest first.
// Read only: no button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from './hub.js';
import { currencySymbol, when } from './texts.js';

export const MAX_ITEMS = 8;

export const TEXT = {
  items: { en: 'Items', fr: 'Objets', de: 'Gegenstände', es: 'Objetos' },
  value: { en: 'Value', fr: 'Valeur', de: 'Wert', es: 'Valor' },
  warranties: { en: 'Warranties', fr: 'Garanties', de: 'Garantien', es: 'Garantías' },
  maintenance: { en: 'Maintenance', fr: 'Entretiens', de: 'Wartungen', es: 'Mantenimientos' },
  warranty_badge: { en: 'Warranty', fr: 'Garantie', de: 'Garantie', es: 'Garantía' },
  maintenance_badge: { en: 'Maintenance', fr: 'Entretien', de: 'Wartung', es: 'Mantenimiento' },
  warranty_title: {
    en: 'Warranty ends',
    fr: 'Fin de garantie',
    de: 'Garantieende',
    es: 'Fin de garantía',
  },
  nothing: {
    en: 'No maintenance due and no warranty ending soon.',
    fr: 'Aucun entretien à faire et aucune garantie qui expire bientôt.',
    de: 'Keine Wartung fällig und keine Garantie, die bald endet.',
    es: 'Ningún mantenimiento pendiente y ninguna garantía a punto de vencer.',
  },
  waiting: {
    en: 'Waiting for Homebox: check the configuration of the integration.',
    fr: "En attente de Homebox : vérifiez la configuration de l'intégration.",
    de: 'Warte auf Homebox: prüfe die Konfiguration der Integration.',
    es: 'Esperando a Homebox: compruebe la configuración de la integración.',
  },
};

const pick = (table, language) => table[language] ?? table.en;
const cut = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** The coming events, the soonest first. */
export function upcomingEvents(summary, language) {
  const events = [...summary.overdue, ...summary.upcoming].map((entry) => ({
    daysLeft: entry.daysLeft,
    title: cut(`${entry.name} · ${entry.item}`, 60),
    subtitle: when(entry.daysLeft, language),
    badge: {
      text: cut(pick(TEXT.maintenance_badge, language), 16),
      color: entry.daysLeft < 0 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.WARNING,
    },
  }));
  for (const item of summary.warranties) {
    events.push({
      daysLeft: item.daysLeft,
      title: cut(`${pick(TEXT.warranty_title, language)} · ${item.name}`, 60),
      subtitle: when(item.daysLeft, language),
      badge: { text: cut(pick(TEXT.warranty_badge, language), 16), color: WIDGET_COLORS.INFO },
    });
  }
  return events
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, MAX_ITEMS)
    .map(({ title, subtitle, badge }) => ({ title, subtitle, badge }));
}

export function buildContent(hub, { language = 'en' } = {}) {
  const summary = hub.summary;
  if (!summary) {
    return {
      ttl_seconds: 60,
      components: [{ type: 'text', variant: 'body', text: pick(TEXT.waiting, language) }],
    };
  }
  const due = summary.overdue.length + summary.upcoming.length;
  const events = upcomingEvents(summary, language);
  const value = {
    type: 'value',
    label: pick(TEXT.value, language),
    value: Math.round(summary.value),
    icon: 'credit-card',
  };
  const symbol = currencySymbol(summary.currency);
  if (symbol) {
    value.unit = symbol;
  }
  return {
    // The hub nudges the widget after every read.
    ttl_seconds: 900,
    components: [
      { type: 'value', label: pick(TEXT.items, language), value: summary.items, icon: 'package' },
      value,
      {
        type: 'value',
        label: pick(TEXT.warranties, language),
        value: summary.warranties.length,
        icon: 'shield',
        color: summary.warranties.length > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
      },
      {
        type: 'value',
        label: pick(TEXT.maintenance, language),
        value: due,
        icon: 'tool',
        color:
          summary.overdue.length > 0
            ? WIDGET_COLORS.DANGER
            : due > 0
              ? WIDGET_COLORS.WARNING
              : WIDGET_COLORS.SUCCESS,
      },
      events.length > 0
        ? { type: 'card-list', display: 'list', items: events }
        : { type: 'text', variant: 'caption', text: pick(TEXT.nothing, language) },
    ],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (hub, request) => buildContent(hub, request),
  },
};
