import { View, Text, Image, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react'
import { Stack, Redirect } from 'expo-router'
import { StatusBar } from 'expo-status-bar';


// const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;


// if (!publishableKey) {
//   throw new Error('Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env')
// }

const AuthLayout = () => {
  return (
    <>
    {/* <ClerkProvider publishableKey={publishableKey}> */}
    <Stack>
      <Stack.Screen
      name="sign-in"
      options={{
        headerShown: false
      }} />
      <Stack.Screen
      name="sign-up"
      options={{
        headerShown: false
      }} />
    </Stack>
    {/* </ClerkProvider> */}
    <StatusBar backgroundColor='white' />
  
    </> 
  )
}

export default AuthLayout