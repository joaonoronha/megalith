import { WEDDING_CONFIG } from '../config/wedding';

/**
 * Downloads a universal iCalendar (.ics) file for Madalena & João's wedding.
 * Creates an all-day event on 16 August 2027 without specific hours or location,
 * labeled strictly as "Casamento Madalena & João".
 * Compatible with Apple Calendar (iOS / macOS), Google Calendar, Outlook, and Android.
 */
export function downloadWeddingCalendar(): void {
  const summary = `Casamento ${WEDDING_CONFIG.coupleDisplayName}`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Madalena & João//Wedding Save the Date//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:wedding-madalena-joao-20270816@save-the-date',
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    'DTSTART;VALUE=DATE:20270816',
    'DTEND;VALUE=DATE:20270817',
    `SUMMARY:${summary}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([icsLines.join('\r\n')], {
    type: 'text/calendar;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'madalena-e-joao-save-the-date.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
