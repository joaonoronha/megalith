import { I18nProvider, type Locale } from './i18n';
import { WEDDING_CONFIG } from './config/wedding';
import { useInvitationGate } from './utils/gate';
import { SaveTheDateGate } from './components/SaveTheDateGate';
import { InvitationHero } from './components/InvitationHero';
import { PaperTexture } from './components/PaperTexture';
import { WeddingCountdown } from './components/WeddingCountdown';
import { WeddingSchedule } from './components/WeddingSchedule';
import { VenueSection } from './components/VenueSection';
import './styles/global.css';
import './styles/invitation.css';

export interface AppProps {
  initialLocale?: Locale;
  unlockUtc?: string;
  searchOverride?: string;
  videoUrl?: string;
}

export function App({
  initialLocale,
  unlockUtc = WEDDING_CONFIG.saveTheDate.unlockUtc,
  searchOverride,
  videoUrl = WEDDING_CONFIG.saveTheDate.videoUrl,
}: AppProps = {}) {
  const { isGated } = useInvitationGate({ unlockUtc, searchOverride });

  return (
    <I18nProvider initialLocale={initialLocale}>
      {isGated ? (
        <SaveTheDateGate unlockUtc={unlockUtc} videoUrl={videoUrl} />
      ) : (
        <main className="wedding-app-root">
          <InvitationHero />
          <div className="wedding-flow-container">
            <PaperTexture />
            <WeddingCountdown />
            <WeddingSchedule />
            <VenueSection />
            <footer className="wedding-footer" role="contentinfo">
              <div className="wedding-footer-divider" aria-hidden="true">
                <span className="footer-line" />
                <span className="footer-diamond">✦</span>
                <span className="footer-line" />
              </div>
              <p className="wedding-footer-names">Madalena &amp; João</p>
              <p className="wedding-footer-date">16 · 08 · 2027</p>
            </footer>
          </div>
        </main>
      )}
    </I18nProvider>
  );
}

export default App;
