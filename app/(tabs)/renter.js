import { StyleSheet, Text, View, ScrollView } from 'react-native'
import React from 'react'
import { Stack, Tabs } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const Profile = () => {
  return (
    <SafeAreaView className="h-full bg-white sand">
    <ScrollView contentContainerStyle={{height: "100%"}}>
    <View className="flex-1 items-center justify-center bg-white"> 
            <Text className="font-rubikblack text-4xl text-center text-#404040 px-8">Renter Dashboard</Text> 
          </View> 
        <View className="flex-1 items-center bg-white"> 
              <Text className="flex-1 font-rubikregular text-regular text-#404040 justify-center text-center px-8">This screen is a temporary placeholder</Text>        
        </View>  
    </ScrollView>
  </SafeAreaView>
  )
}

export default Profile