import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.snapsoft.casaflow.licencias',
  appName: 'CasaFlow Licencias',
  webDir: 'mobile-shell',
  server: {
    url: 'https://casaflowpro.app/control/licencias',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
