import { NextFunction, Request, Response } from 'express';
import {
  getAuthUrl,
  getTokensFromCode,
  setCredentials,
  getStoredTokens,
  setupCalendarWatch,
  getCalendarEvent,
  listRecentCalendarEvents,
  listCalendars,
} from '../../packages/google/oAuth2Client';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import prisma from '../../packages/lib/db';
import { ReservationStatus } from '@prisma/client';
import { logger } from '../../packages/common/logger';

const recentWebhooks = new Map<string, number>();
const WEBHOOK_COOLDOWN = 5000;

export const getGoogleAuthUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUrl = getAuthUrl();

    return res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
};

export const handleGoogleCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      throwError('Authorization code is required', 400);
      return;
    }

    const tokens = await getTokensFromCode(code);

    if (!tokens) {
      throwError('Failed to get tokens from authorization code', 400);
      return;
    }

    setCredentials(tokens);

    const tokenInfo = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    };

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throwError('Failed to get tokens from authorization code', 400);
      return;
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      throwError('Google Calendar ID is not set', 400);
      return;
    }

    await prisma.googleCalendarToken.upsert({
      where: { calendarId: process.env.GOOGLE_CLIENT_ID },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: BigInt(tokens.expiry_date),
      },
      create: {
        calendarId: process.env.GOOGLE_CLIENT_ID,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: BigInt(tokens.expiry_date),
      },
    });

    res.status(200).json({
      message: '✅ Google Calendar authorized successfully!',
      tokens: tokenInfo,
    });
  } catch (error) {
    next(error);
  }
};

export const checkGoogleAuthStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await getStoredTokens();

    if (tokens) {
      res.status(200).json({
        authorized: true,
        message: 'Google Calendar is authorized',
      });
    } else {
      res.status(200).json({
        authorized: false,
        message: 'Google Calendar is not authorized',
        authUrl: getAuthUrl(),
      });
    }
  } catch (error) {
    next(error);
  }
};

export const handleCalendarWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resourceState = req.headers['x-goog-resource-state'];

    if (resourceState === 'sync') {
      logger.info('Google Calendar webhook sync notification received');
      return res.status(200).send('OK');
    }

    const resourceUri = req.headers['x-goog-resource-uri'] as string;
    const match = resourceUri?.match(/calendars\/([^\/]+)/);
    const calendarId = match ? decodeURIComponent(match[1]) : (req.query.calendarId as string);

    if (!calendarId) {
      logger.warn('No Calendar ID found');
      return res.status(200).send('OK');
    }

    const lastProcessed = recentWebhooks.get(calendarId);
    const now = Date.now();

    if (lastProcessed && (now - lastProcessed) < WEBHOOK_COOLDOWN) {
      logger.info(`Ignoring duplicate webhook for ${calendarId} (cooldown: ${WEBHOOK_COOLDOWN}ms)`);
      return res.status(200).send('OK');
    }

    recentWebhooks.set(calendarId, now);

    for (const [key, timestamp] of recentWebhooks.entries()) {
      if (now - timestamp > 60000) {
        recentWebhooks.delete(key);
      }
    }

    const barber = await prisma.barber.findUnique({
      where: { googleCalendarId: calendarId },
    });

    if (!barber) {
      logger.warn(`No barber found for calendar ID: ${calendarId}`);
      return res.status(200).send('OK');
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let events;
    try {
      events = await listRecentCalendarEvents(calendarId, 20, { updatedMin: fiveMinutesAgo });
    } catch (error: any) {
      if (error.message?.includes('Quota exceeded')) {
        logger.warn(`Quota exceeded for calendar ${calendarId}, will retry later`);
        return res.status(200).send('OK');
      }
      throw error;
    }

    if (!events || events.length === 0) {
      logger.info('No events updated in the last 5 minutes');
      return res.status(200).send('OK');
    }

    const processedEventIds = new Set<string>();

    for (const event of events) {
      if (event.status === 'cancelled') {
        logger.info(`Event ${event.id} was cancelled`);
        continue;
      }

      if (!event.id || !event.start?.dateTime) {
        logger.warn(`Event missing required fields: id=${event.id}, start=${event.start?.dateTime}`);
        continue;
      }

      if (processedEventIds.has(event.id)) {
        logger.info(`Skipping duplicate event ${event.id} in same batch`);
        continue;
      }

      const existing = await prisma.reservation.findFirst({
        where: {
          OR: [
            { googleEventId: event.id },
            {
              barberId: barber.id,
              date: new Date(event.start.dateTime)
            }
          ]
        },
      });

      if (!existing) {
        logger.info(`Processing new event: ${event.id} - "${event.summary || 'Untitled'}"`);
        await createReservationFromEvent(event, barber.id);
        processedEventIds.add(event.id);
      } else if (existing && !existing.googleEventId) {
        logger.info(`Linking googleEventId ${event.id} to existing reservation ${existing.id}`);
        await prisma.reservation.update({
          where: { id: existing.id },
          data: { googleEventId: event.id }
        });
        processedEventIds.add(event.id);
      } else {
        logger.info(`Skipping event ${event.id} - reservation already exists with googleEventId`);
        processedEventIds.add(event.id);
      }
    }

    res.status(200).send('OK');
  } catch (error: any) {
    logger.error(`Webhook Error: ${error.message}`);
    res.status(200).send('OK');
  }
};

const createReservationFromEvent = async (event: any, barberId: string) => {
  try {
    if (!event.start?.dateTime || !event.end?.dateTime) {
      logger.warn('Event missing start or end time');
      return;
    }

    if (!event.id) {
      logger.warn('Event missing Google Event ID');
      return;
    }

    const startDate = new Date(event.start.dateTime);
    const endDate = new Date(event.end.dateTime);

    const existing = await prisma.reservation.findFirst({
      where: {
        OR: [
          { googleEventId: event.id },
          {
            barberId,
            date: startDate,
          },
        ],
      },
    });

    if (existing) {
      if (existing.googleEventId === event.id) {
        logger.info(`Reservation already exists with googleEventId: ${event.id}`);
      } else {
        logger.info(`Updating existing reservation ${existing.id} with googleEventId: ${event.id}`);
        await prisma.reservation.update({
          where: { id: existing.id },
          data: { googleEventId: event.id },
        });
      }
      return;
    }

    const eventTitle = event.summary || 'New Reservation';
    const eventDescription = event.description || '';

    let clientName = eventTitle.replace(/^Client:\s*/i, '').trim() || 'Unknown Client';
    let clientPhone = '';
    let clientEmail = '';

    if (eventDescription) {
      const phoneMatch = eventDescription.match(/Phone:\s*([^\n]+)/i);
      const emailMatch = eventDescription.match(/Email:\s*([^\n]+)/i);

      if (phoneMatch) clientPhone = phoneMatch[1].trim();
      if (emailMatch) clientEmail = emailMatch[1].trim();
    }

    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

    const services = await prisma.service.findMany({
      where: { isActive: true },
    });

    let serviceId: string | null = null;
    const matchingService = services.find(s => Math.abs(s.duration - durationMinutes) <= 5);

    if (matchingService) {
      serviceId = matchingService.id;
    } else if (services.length > 0) {
      serviceId = services[0].id;
    } else {
      logger.warn('No active services found, cannot create reservation');
      return;
    }

    logger.info(`Creating reservation from Google Calendar event: ${event.id} for ${clientName}`);

    try {
      const reservation = await prisma.reservation.create({
        data: {
          barberId,
          date: startDate,
          endDate,
          status: ReservationStatus.PENDING,
          clientName,
          clientPhone: clientPhone || 'N/A',
          clientEmail: clientEmail || 'N/A',
          serviceId: serviceId!,
          googleEventId: event.id,
        },
      });

      logger.info(`✅ Created reservation ${reservation.id} from Google Calendar event: ${event.id}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        const target = error.meta?.target || [];

        if (target.includes('googleEventId')) {
          logger.info(`Reservation with googleEventId ${event.id} already exists`);
          return;
        } else if (target.includes('date') || target.includes('barberId')) {
          logger.info(`Reservation exists for date+barberId, updating with googleEventId: ${event.id}`);
          const existing = await prisma.reservation.findFirst({
            where: {
              barberId,
              date: startDate,
            },
          });

          if (existing) {
            if (!existing.googleEventId) {
              await prisma.reservation.update({
                where: { id: existing.id },
                data: { googleEventId: event.id },
              });
              logger.info(`✅ Updated reservation ${existing.id} with googleEventId: ${event.id}`);
            } else if (existing.googleEventId === event.id) {
              logger.info(`Reservation ${existing.id} already has googleEventId: ${event.id}`);
            }
          }
          return;
        }

        logger.warn(`Reservation already exists (duplicate key): ${error.message}`);
      } else {
        logger.error(`Error creating reservation from event: ${error.message}`);
        throw error;
      }
    }
  } catch (error: any) {
    logger.error(`Error in createReservationFromEvent: ${error.message}`);
  }
};

export const getAvailableCalendars = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calendars = await listCalendars();

    if (!calendars) {
      throwError('Failed to list calendars', 400);
      return;
    }

    const formattedCalendars = calendars.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      accessRole: cal.accessRole,
    }));

    res.status(200).json({
      calendars: formattedCalendars,
      message: `Found ${formattedCalendars.length} calendar(s). Use "primary" for your main calendar, or any calendar ID from the list above.`,
    });
  } catch (error) {
    next(error);
  }
};

export const setupWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { calendarId } = req.body;

    if (!calendarId) {
      throwError('Calendar ID is required. Use "primary" for your main calendar, or get available calendars from /api/google/calendars', 400);
      return;
    }

    const webhookUrl =
      process.env.GOOGLE_WEBHOOK_URL || `${req.protocol}://${req.get('host')}/api/google/webhook?calendarId=${calendarId}`;

    const watch = await setupCalendarWatch(calendarId, webhookUrl);

    if (!watch) {
      throwError('Failed to set up calendar watch', 400);
      return;
    }

    await prisma.googleCalendarWatch.upsert({
      where: { calendarId },
      update: {
        channelId: watch.channelId,
        resourceId: watch.resourceId,
        expiration: BigInt(watch.expiration),
        webhookUrl: webhookUrl,
      },
      create: {
        calendarId,
        channelId: watch.channelId,
        resourceId: watch.resourceId,
        expiration: BigInt(watch.expiration),
        webhookUrl: webhookUrl,
      },
    });

    res.status(200).json({
      message: 'Calendar webhook enabled successfully',
      watch: {
        ...watch,
        expiration: watch.expiration,
      },
      note: 'Webhook will auto-renew before expiration via cron job.',
    });
  } catch (error) {
    next(error);
  }
};

export const renewExpiredWatches = async () => {
  try {
    logger.info('Starting watch renewal cron job');

    const watches = await prisma.googleCalendarWatch.findMany();
    const twoDaysFromNow = BigInt(Date.now() + (2 * 24 * 60 * 60 * 1000));

    let renewedCount = 0;
    let failedCount = 0;

    for (const watch of watches) {
      try {
        const expirationTime = BigInt(watch.expiration);

        if (expirationTime < twoDaysFromNow) {
          logger.info(`Renewing watch for calendar ${watch.calendarId}`);

          const newWatch = await setupCalendarWatch(watch.calendarId, watch.webhookUrl);

          if (newWatch) {
            await prisma.googleCalendarWatch.update({
              where: { calendarId: watch.calendarId },
              data: {
                channelId: newWatch.channelId,
                resourceId: newWatch.resourceId,
                expiration: BigInt(newWatch.expiration),
              },
            });

            renewedCount++;
            logger.info(`✅ Successfully renewed watch for ${watch.calendarId}`);
          }
        } else {
          const daysRemaining = Number(expirationTime - BigInt(Date.now())) / (24 * 60 * 60 * 1000);
          logger.info(`Watch for ${watch.calendarId} still valid for ${daysRemaining.toFixed(1)} days`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        failedCount++;
        logger.error(`Failed to renew watch for ${watch.calendarId}: ${error.message}`);
      }
    }

    logger.info(`Watch renewal completed. Renewed: ${renewedCount}, Failed: ${failedCount}`);
  } catch (error: any) {
    logger.error(`Error in renewExpiredWatches cron job: ${error.message}`);
  }
};