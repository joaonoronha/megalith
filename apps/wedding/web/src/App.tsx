import { I18nProvider, type Locale } from './i18n';
import { InvitationHero } from './components/InvitationHero';
import { WeddingCountdown } from './components/WeddingCountdown';
import { VenueSection } from './components/VenueSection';
import './styles/global.css';
import './styles/invitation.css';

export interface AppProps {
  initialLocale?: Locale;
}

export function App({ initialLocale }: AppProps = {}) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <main className="wedding-app-root">
        <InvitationHero />
        <div className="wedding-flow-container">
          <WeddingCountdown />
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
    </I18nProvider>
  );
}

export default App;
