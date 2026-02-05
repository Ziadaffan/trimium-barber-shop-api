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

// Webhook handler - receives notifications from Google Calendar
export const handleCalendarWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resourceState = req.headers['x-goog-resource-state'];

    // 1. Quick exit for sync notifications
    if (resourceState === 'sync') {
      logger.info('Google Calendar webhook sync notification received');
      return res.status(200).send('OK');
    }

    // 2. Extract Calendar ID
    const resourceUri = req.headers['x-goog-resource-uri'] as string;
    const match = resourceUri?.match(/calendars\/([^\/]+)/);
    const calendarId = match ? decodeURIComponent(match[1]) : (req.query.calendarId as string);

    if (!calendarId) {
      logger.warn('No Calendar ID found');
      return res.status(200).send('OK');
    }

    // 3. Find the Barber
    const barber = await prisma.barber.findUnique({
      where: { googleCalendarId: calendarId },
    });

    if (!barber) {
      logger.warn(`No barber found for calendar ID: ${calendarId}`);
      return res.status(200).send('OK');
    }

    // 4. Fetch events updated VERY recently
    // Use updatedMin to reduce the payload size and handle eventual consistency
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const events = await listRecentCalendarEvents(calendarId, 20, { updatedMin: fiveMinutesAgo });

    if (!events || events.length === 0) {
      logger.info('No events updated in the last 5 minutes');
      return res.status(200).send('OK');
    }

    // Process events (Google sometimes batches these)
    // Track processed event IDs to avoid duplicates in the same batch
    const processedEventIds = new Set<string>();

    for (const event of events) {
      if (event.status === 'cancelled') {
        // Handle deletion if necessary
        logger.info(`Event ${event.id} was cancelled`);
        continue;
      }

      if (!event.id || !event.start?.dateTime) {
        logger.warn(`Event missing required fields: id=${event.id}, start=${event.start?.dateTime}`);
        continue;
      }

      // Skip if we've already processed this event ID in this batch
      if (processedEventIds.has(event.id)) {
        logger.info(`Skipping duplicate event ${event.id} in same batch`);
        continue;
      }

      // 5. Check by Google Event ID (The Golden Standard)
      const existing = await prisma.reservation.findFirst({
        where: {
          OR: [
            { googleEventId: event.id },
            // Fallback for old records without IDs - check unique constraint
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
        // Link the ID if it was missing
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
    // Always return 200 to prevent Google from retrying
    res.status(200).send('OK');
  }
};

// Create reservation from Google Calendar event
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

    // Check if reservation already exists by googleEventId OR by unique constraint (date + barberId)
    // This prevents race conditions when multiple webhooks arrive simultaneously
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
        // Reservation exists by date/barberId but doesn't have googleEventId - update it
        logger.info(`Updating existing reservation ${existing.id} with googleEventId: ${event.id}`);
        await prisma.reservation.update({
          where: { id: existing.id },
          data: { googleEventId: event.id },
        });
      }
      return;
    }

    // Extract content from event
    const eventTitle = event.summary || 'New Reservation';
    const eventDescription = event.description || '';

    // Parse client info from title and description
    let clientName = eventTitle.replace(/^Client:\s*/i, '').trim() || 'Unknown Client';
    let clientPhone = '';
    let clientEmail = '';

    // Extract phone and email from description
    if (eventDescription) {
      const phoneMatch = eventDescription.match(/Phone:\s*([^\n]+)/i);
      const emailMatch = eventDescription.match(/Email:\s*([^\n]+)/i);

      if (phoneMatch) clientPhone = phoneMatch[1].trim();
      if (emailMatch) clientEmail = emailMatch[1].trim();
    }

    // Calculate duration in minutes
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

    // Find a matching service by duration (within 5 minutes tolerance)
    const services = await prisma.service.findMany({
      where: { isActive: true },
    });

    let serviceId: string | null = null;
    const matchingService = services.find(s => Math.abs(s.duration - durationMinutes) <= 5);

    if (matchingService) {
      serviceId = matchingService.id;
    } else if (services.length > 0) {
      // Use first active service as fallback
      serviceId = services[0].id;
    } else {
      logger.warn('No active services found, cannot create reservation');
      return;
    }

    // Create reservation with googleEventId
    // Use try-catch to handle race conditions when multiple webhooks arrive simultaneously
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
          googleEventId: event.id, // Store the Google Event ID
        },
      });

      logger.info(`✅ Created reservation ${reservation.id} from Google Calendar event: ${event.id}`);
    } catch (error: any) {
      // Handle duplicate key errors (race condition - another webhook created it first)
      if (error.code === 'P2002') {
        // Check if it's the date+barberId constraint or googleEventId constraint
        const target = error.meta?.target || [];

        if (target.includes('googleEventId')) {
          // Another reservation already has this googleEventId - skip
          logger.info(`Reservation with googleEventId ${event.id} already exists`);
          return;
        } else if (target.includes('date') || target.includes('barberId')) {
          // Reservation exists for this date+barberId - update it with googleEventId if missing
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
    // Outer catch for any other errors
    logger.error(`Error in createReservationFromEvent: ${error.message}`);
  }
};

// List available calendars
export const getAvailableCalendars = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calendars = await listCalendars();

    if (!calendars) {
      throwError('Failed to list calendars', 400);
      return;
    }

    // Format response with useful information
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

// Setup webhook for a calendar
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

    res.status(200).json({
      message: 'Calendar webhook enabled successfully',
      watch,
      note: 'Webhook will expire in 7 days. You will need to renew it.',
    });
  } catch (error) {
    next(error);
  }
};
