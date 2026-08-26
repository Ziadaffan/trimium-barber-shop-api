# trimium-barber-shop-api

Express + Prisma API for the Trimium barber shop: services, barbers, schedules, reservations,
Google Calendar sync and the client confirmation email.

## Getting started

```bash
yarn install
yarn migration:deploy   # apply pending migrations
yarn dev                # http://localhost:3000
yarn test               # vitest, no database required
```

## Authentication

Authentication is declared per route, in the route files, next to the handler it protects.

| Audience               | Credential                                                                         | Examples                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Public website         | none                                                                               | `GET /api/services`, `GET /api/reservations/available-times`, `POST /api/reservations` |
| Client, from the email | signed token in the link                                                           | `GET` and `POST /api/reservations/cancel`                                              |
| Admin app              | `Authorization: Bearer <jwt>` from `/api/auth/login`                               | `GET /api/reservations`, all writes, `/api/google/*`                                   |
| Trusted backend        | `x-timestamp` + `x-signature` (HMAC of `METHOD\nURL\nTIMESTAMP` with `API_SECRET`) | same as admin                                                                          |
| Vercel Cron            | `Authorization: Bearer <CRON_SECRET>`                                              | `GET /api/cron/renew-watches`                                                          |

`POST /api/signature` mints a signature for a caller that is already authenticated. It must never
be public: it hands out credentials for any method and URL.

`GET /api/google/auth` returns `{ authUrl }` for the admin app to redirect to. The OAuth callback
stays publicly reachable because Google redirects a browser to it, and is protected by the signed
`state` that only `/api/google/auth` can mint.

## Environment variables

| Variable                                                          | Required          | Purpose                                                                                                                                    |
| ----------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                    | yes               | Postgres connection string                                                                                                                 |
| `API_SECRET`                                                      | yes               | HMAC secret for signed requests, OAuth state and cancellation links                                                                        |
| `JWT_SECRET`                                                      | yes               | Signs the admin token                                                                                                                      |
| `LOGIN_EMAIL`, `LOGIN_PASSWORD`                                   | yes               | Admin credentials checked by `/api/auth/login`                                                                                             |
| `PUBLIC_API_URL`                                                  | yes in production | Base URL used to build the cancellation link in emails. Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`, then the request host |
| `CRON_SECRET`                                                     | yes on Vercel     | Vercel only sends the cron authorization header when this exists                                                                           |
| `RESEND_API_KEY`, `RESEND_FROM`                                   | yes to send email | Confirmation email delivery (`RESEND_ENABLED=false` disables it)                                                                           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | for calendar sync | OAuth client                                                                                                                               |
| `GOOGLE_WEBHOOK_URL`                                              | for calendar sync | Where Google posts calendar changes                                                                                                        |
| `RESERVATION_CANCEL_SECRET`                                       | no                | Dedicated secret for cancellation links, defaults to `API_SECRET`                                                                          |
| `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_PHONE`                         | no                | Shown in the email, the calendar event and the cancellation pages                                                                          |
| `TELEMETRY_SOURCE_TOKEN`, `TELEMETRY_ENDPOINT`                    | no                | Logtail; without them logs go to stdout                                                                                                    |
| `CORS_ORIGINS`                                                    | no                | Comma separated allowlist; every origin is allowed when unset                                                                              |

## Reservations

Times are stored in UTC and rendered in `America/Toronto`.

Availability is computed by interval overlap, so a booking that does not sit on the half-hour grid
still blocks the slot it covers, and slots that have already passed today are not offered.

The confirmation email is sent in the language of the booking (`locale: 'fr' | 'en'` in the request
body, falling back to `Accept-Language`, then French) and carries two buttons: add to Google
Calendar, and cancel. Clients can cancel up to `CANCELLATION_CUTOFF_MINUTES` (15) before the
appointment starts. The cancellation link is an HMAC of the reservation id and its start time, so it
stops working once the appointment is rescheduled. Opening the link only renders a confirmation
page — the cancellation happens on submit, so mail clients that pre-fetch links cannot cancel an
appointment on the client's behalf.

Editing or deleting a reservation keeps the barber's Google Calendar in step: the event is moved,
recreated on the new barber's calendar, or deleted. A calendar outage is logged and never fails the
booking itself.

## Tests

`yarn test` runs the whole suite with Vitest. Prisma and Google are mocked, so no database or
network is touched. `yarn typecheck` typechecks `src` and `tests`.
