const fs = require("fs");
const path = require("path");

module.exports = {
  expo: {
    name: "Lucky Charm Creations",
    slug: "mobileshop",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/lcc.png",
    scheme: "mobileshop",
    userInterfaceStyle: "automatic",

    ios: {
      icon: "./assets/expo.icon",
    },

    android: {
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      predictiveBackGestureEnabled: false,
      package: "com.anupama1.mobileshop",

      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/lcc.png",
      },
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#208AEF",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
      "expo-video",
      "expo-web-browser",
      "expo-notifications",
      "expo-image-picker",
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      router: {},
      eas: {
        projectId: "7222c7f8-fbc1-4f00-a92c-50a1af1e6414",
      },
    },
  },
};
