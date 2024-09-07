import React, { useEffect } from "react";
import { Text, View, Image } from "react-native";
import { SplashScreen, Stack } from "expo-router";
import { useFonts } from "expo-font";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
// import GlobalProvider from "../context/GlobalProvider";
import * as SecureStore from "expo-secure-store";
import PaymentScreen from "./payment.js/PaymentScreen";

// Ensure the publishable key is set
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error('Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env');
}

// Token cache implementation
const tokenCache = {
  async getToken(key) {
    try {
      const item = await SecureStore.getItemAsync(key);
      if (item) {
        console.log(`${key} was used 🔐 \n`);
      } else {
        console.log('No values stored under key: ' + key);
      }
      return item;
    } catch (error) {
      console.error('SecureStore get item error: ', error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error('SecureStore save item error: ', err);
    }
  },
};

SplashScreen.preventAutoHideAsync();

const RootLayout = () => {
  const [fontsLoaded, error] = useFonts({
    "Rubik-Black": require("../Assets/fonts/Rubik-Black.ttf"),
    "Rubik-Bold": require("../Assets/fonts/Rubik-Bold.ttf"),
    "Rubik-Regular": require("../Assets/fonts/Rubik-Regular.ttf"),
    "Rubik-Medium": require("../Assets/fonts/Rubik-Medium.ttf"),
    "Rubik-ExtraBold": require("../Assets/fonts/Rubik-ExtraBold.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) return null;

  return (
   
      <ClerkProvider publishableKey={publishableKey}>
        <ClerkLoaded>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="screens/renter_sign_in" options={{ headerShown: false }} />
            <Stack.Screen name="search/[query]" options={{ headerShown: false }} />
            <Stack.Screen name="cfi" options={{ headerShown: false }} />

          </Stack>
        </ClerkLoaded>
      </ClerkProvider>
   
  );
};

export default RootLayout;
