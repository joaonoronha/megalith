import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadWeddingCalendar } from '../src/utils/calendar';

describe('downloadWeddingCalendar', () => {
  let createdUrl = '';

  beforeEach(() => {
    createdUrl = '';
    globalThis.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      createdUrl = `blob:mock-url-${blob.size}`;
      return createdUrl;
    });
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates and triggers download of .ics calendar event with wedding details', async () => {
    let capturedBlob: Blob | null = null;
    globalThis.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      createdUrl = `blob:mock-url-${blob.size}`;
      return createdUrl;
    });

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    downloadWeddingCalendar();

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(createdUrl);

    // Verify blob content: all-day event, summary only, no hour, no location
    expect(capturedBlob).not.toBeNull();
    const reader = new FileReader();
    const textPromise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
    });
    reader.readAsText(capturedBlob as unknown as Blob);
    const text = await textPromise;

    expect(text).toContain('SUMMARY:Casamento Madalena & João');
    expect(text).toContain('DTSTART;VALUE=DATE:20270816');
    expect(text).not.toContain('LOCATION');
    expect(text).not.toContain('T150000Z');
  });
});
