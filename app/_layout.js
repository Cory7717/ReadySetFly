import { Text, View, Image } from "react-native";
import { useEffect } from "react";
import { SplashScreen, Stack, Tabs } from "expo-router";
import { useFonts } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/stack";
import GlobalProvider from "../context/GlobalProvider";
// import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
// import { Slot } from "expo-router"

// const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
// if (!publishableKey) {
//   throw new Error('Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env')
// }

SplashScreen.preventAutoHideAsync();

const App = () => {};

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
    <GlobalProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="search/[query]" options={{ headerShown: false }} />
        <Stack.Screen name="cfi" options={{ headerShown: false }} />
        {/* <Stack.Screen name="renterProfile" options={{ headerShown: true }} /> */}
        
      </Stack>
    </GlobalProvider>
  );
};

export default RootLayout;
