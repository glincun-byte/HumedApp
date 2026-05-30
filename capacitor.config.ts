import type { CapacitorConfig } from '@capacitor/cli';

const config = {
  appId: 'com.ecovigia.app',
  appName: 'Humedales-app',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
        SplashScreen: {
      launchShowDuration: 2000, // Durará 2 segundos exactos
      launchAutoHide: true,
      backgroundColor: "#dbe7df", // Puedes poner el color de fondo de tu app aquí
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#059669",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
