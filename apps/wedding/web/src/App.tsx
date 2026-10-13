import { I18nProvider, type Locale } from './i18n';
import { InvitationHero } from './components/InvitationHero';
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
      </main>
    </I18nProvider>
  );
}

export default App;
