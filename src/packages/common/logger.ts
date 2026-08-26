import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import winston from 'winston';

const isLocal = process.env.ENV === 'dev';
const telemetryToken = process.env.TELEMETRY_SOURCE_TOKEN;
const telemetryEndpoint = process.env.TELEMETRY_ENDPOINT;

const consoleTransport = () =>
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  });

const transports: winston.transport[] = [];

if (isLocal) {
  transports.push(consoleTransport());
} else if (telemetryToken) {
  // Logtail throws on an empty token, so it is only built once we know we have one. The endpoint
  // is omitted rather than passed as undefined, which would override Logtail's own default.
  transports.push(
    new LogtailTransport(new Logtail(telemetryToken, telemetryEndpoint ? { endpoint: telemetryEndpoint } : undefined))
  );
} else {
  // Degrade to stdout rather than crashing the process on a missing variable.
  transports.push(consoleTransport());
}

if (process.env.NODE_ENV === 'test') {
  transports.length = 0;
  transports.push(new winston.transports.Console({ silent: true }));
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
