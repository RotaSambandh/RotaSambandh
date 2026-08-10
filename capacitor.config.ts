const config = {
  appId: "app.rotasambandh.mobile",
  appName: "RotaSambandh",
  // Live URL shell (Next.js SSR on Netlify) — not a static `out/` export.
  webDir: "out",
  server: {
    // Production: NEXT_PUBLIC_APP_URL=https://rotasambandh.com before `npx cap sync android`.
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    cleartext: !(process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#0a2540",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a2540",
    },
    FirebaseAuthentication: {
      // Web Firebase Auth stays source of truth; native layer only supplies Google credential.
      skipNativeAuth: true,
      providers: ["google.com"],
    },
  },
};

export default config;
