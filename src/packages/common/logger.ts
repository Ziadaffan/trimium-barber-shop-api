import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import winston from 'winston';

const isLocal = process.env.ENV === 'dev';

const logtail = new Logtail(process.env.TELEMETRY_SOURCE_TOKEN ?? '', {
  endpoint: process.env.TELEMETRY_ENDPOINT ?? '',
});

const transports: winston.transport[] = [];

if (isLocal) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
} else {
  transports.push(new LogtailTransport(logtail));
}

const estTimestamp = winston.format.timestamp({
  format: () =>
    new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
});

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(estTimestamp, winston.format.errors({ stack: true }), winston.format.json()),
  transports,
});
