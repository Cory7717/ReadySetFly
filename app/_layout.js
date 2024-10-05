import React, { useEffect } from "react"; 
import { SplashScreen, Stack } from "expo-router";
import { useFonts } from "expo-font";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { StripeProvider } from "@stripe/stripe-react-native";

// Retrieve Clerk Publishable Key
const getClerkPublishableKey = () => {
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!clerkPublishableKey) {
    throw new Error('Missing Clerk Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env');
  }
  return clerkPublishableKey;
};

// Retrieve Stripe Publishable Key
const getStripePublishableKey = () => {
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!stripePublishableKey) {
    throw new Error('Missing Stripe Publishable Key. Please set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env');
  }
  return stripePublishableKey;
};

// Token cache implementation for authentication handling
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

  // Get keys separately
  const clerkPublishableKey = getClerkPublishableKey();
  const stripePublishableKey = getStripePublishableKey();

  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ClerkLoaded>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="screens/renter_sign_in" options={{ headerShown: false }} />
            <Stack.Screen name="search/[query]" options={{ headerShown: false }} />
            
            {/* <Stack.Screen name="cfi" options={{ headerShown: false }} /> */}
            {/* Other screens */}
          </Stack>
        </ClerkLoaded>
      </ClerkProvider>
    </StripeProvider>
  );
};

export default RootLayout;
