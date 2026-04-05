/**
 * logger.ts — Logger conditionnel
 * En production : silencieux (aucune donnée médicale dans les DevTools)
 * En développement : affiche tout normalement
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
  info: (...args: unknown[]) => { if (isDev) console.info(...args); },
};
