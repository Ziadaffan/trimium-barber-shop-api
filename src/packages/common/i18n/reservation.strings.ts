import type { Locale } from './locale';

export interface ReservationStrings {
  htmlLang: string;
  email: {
    subject: (params: { serviceName: string; day: string; time: string }) => string;
    title: string;
    greeting: (clientName: string) => string;
    intro: string;
    labelService: string;
    labelBarber: string;
    labelWhen: string;
    labelPhone: string;
    addToGoogleCalendar: string;
    cancelCta: string;
    cancelPolicy: (params: { minutes: number; deadlineTime: string }) => string;
    ignoreNote: string;
    signature: string;
  };
  cancelPage: {
    title: string;
    heading: string;
    question: string;
    labelService: string;
    labelBarber: string;
    labelWhen: string;
    confirmCta: string;
    keepNote: string;
    successTitle: string;
    successHeading: string;
    successMessage: string;
    rebookNote: string;
    errorTitle: string;
    invalidLink: string;
    notFound: string;
    tooLate: (params: { minutes: number }) => string;
    serverError: string;
    callShop: (phone: string) => string;
  };
}

const en: ReservationStrings = {
  htmlLang: 'en',
  email: {
    subject: ({ serviceName, day, time }) => `Reservation confirmed • ${serviceName} • ${day} at ${time}`,
    title: 'Reservation confirmed',
    greeting: clientName => `Hi ${clientName},`,
    intro: 'Your reservation is confirmed.',
    labelService: 'Service',
    labelBarber: 'Barber',
    labelWhen: 'When',
    labelPhone: 'Phone',
    addToGoogleCalendar: 'Add to Google Calendar',
    cancelCta: 'Cancel my reservation',
    cancelPolicy: ({ minutes, deadlineTime }) =>
      `You can cancel online until ${deadlineTime}, that is up to ${minutes} minutes before your appointment starts.`,
    ignoreNote: 'If you did not make this reservation, you can ignore this email.',
    signature: 'See you soon!',
  },
  cancelPage: {
    title: 'Cancel your reservation',
    heading: 'Cancel your reservation',
    question: 'Do you really want to cancel this reservation?',
    labelService: 'Service',
    labelBarber: 'Barber',
    labelWhen: 'When',
    confirmCta: 'Yes, cancel my reservation',
    keepNote: 'If you changed your mind, simply close this page — your reservation stays active.',
    successTitle: 'Reservation cancelled',
    successHeading: 'Your reservation has been cancelled',
    successMessage: 'The time slot has been released. You will not receive any further reminder for this appointment.',
    rebookNote: 'You can book a new appointment whenever you want.',
    errorTitle: 'Cancellation not possible',
    invalidLink: 'This cancellation link is invalid or has expired.',
    notFound: 'This reservation no longer exists. It may already have been cancelled.',
    tooLate: ({ minutes }) =>
      `It is too late to cancel online: cancellations must be made at least ${minutes} minutes before the appointment starts.`,
    serverError: 'Something went wrong on our side. Please try again in a moment.',
    callShop: phone => `Please call us at ${phone} and we will take care of it.`,
  },
};

const fr: ReservationStrings = {
  htmlLang: 'fr',
  email: {
    subject: ({ serviceName, day, time }) => `Réservation confirmée • ${serviceName} • ${day} à ${time}`,
    title: 'Réservation confirmée',
    greeting: clientName => `Bonjour ${clientName},`,
    intro: 'Votre réservation est confirmée.',
    labelService: 'Service',
    labelBarber: 'Barbier',
    labelWhen: 'Quand',
    labelPhone: 'Téléphone',
    addToGoogleCalendar: 'Ajouter à Google Agenda',
    cancelCta: 'Annuler ma réservation',
    cancelPolicy: ({ minutes, deadlineTime }) =>
      `Vous pouvez annuler en ligne jusqu'à ${deadlineTime}, soit au plus tard ${minutes} minutes avant le début du rendez-vous.`,
    ignoreNote: "Si vous n'avez pas fait cette réservation, vous pouvez ignorer ce courriel.",
    signature: 'À bientôt!',
  },
  cancelPage: {
    title: 'Annuler votre réservation',
    heading: 'Annuler votre réservation',
    question: 'Voulez-vous vraiment annuler cette réservation?',
    labelService: 'Service',
    labelBarber: 'Barbier',
    labelWhen: 'Quand',
    confirmCta: 'Oui, annuler ma réservation',
    keepNote: 'Si vous avez changé d’avis, fermez simplement cette page : votre réservation reste active.',
    successTitle: 'Réservation annulée',
    successHeading: 'Votre réservation a été annulée',
    successMessage: 'La plage horaire a été libérée. Vous ne recevrez plus de rappel pour ce rendez-vous.',
    rebookNote: 'Vous pouvez reprendre un rendez-vous quand vous le souhaitez.',
    errorTitle: 'Annulation impossible',
    invalidLink: "Ce lien d'annulation est invalide ou a expiré.",
    notFound: 'Cette réservation n’existe plus. Elle a peut-être déjà été annulée.',
    tooLate: ({ minutes }) =>
      `Il est trop tard pour annuler en ligne : l'annulation doit être faite au moins ${minutes} minutes avant le début du rendez-vous.`,
    serverError: 'Une erreur est survenue de notre côté. Veuillez réessayer dans un instant.',
    callShop: phone => `Appelez-nous au ${phone} et nous nous en occupons.`,
  },
};

const STRINGS: Record<Locale, ReservationStrings> = { en, fr };

export const getReservationStrings = (locale: Locale): ReservationStrings => STRINGS[locale];
