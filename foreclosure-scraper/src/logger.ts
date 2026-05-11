import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.logLevel,
  ...(config.logPretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
  redact: {
    paths: ['*.password', '*.apiKey', '*.token', 'config.*.secret'],
    censor: '[REDACTED]',
  },
});
