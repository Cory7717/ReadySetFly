import { View, Text, Image, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react'
import { Stack, Redirect } from 'expo-router'
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider } from '@clerk/clerk-expo';
import { useAuth } from '@clerk/clerk-expo'


const AuthLayout = () => {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return <Redirect href={'app\(tabs)\home.js'} />
  }

  return (
   
    <>
    
    
    <Stack>
    {/* <Stack.Screen
      name="renter_sign_in"
      options={{
        headerShown: false
      }} /> */}
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
   
    <StatusBar backgroundColor='white' />
  
    </>
   
  )
}

export default AuthLayout