import { StyleSheet, Text, View, ScrollView } from 'react-native'
import React from 'react'
import { Stack, Tabs } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const Flights = () => {
  return (
    <SafeAreaView className="h-full bg-white sand">
    <ScrollView contentContainerStyle={{height: "100%"}}>
    <View className="flex-1 items-center justify-center bg-white"> 
            <Text className="font-rubikblack text-4xl text-center text-#404040 px-8">Upcoming Airshows and General Aviation Events</Text> 
          </View> 
        <View className="flex-1 items-center bg-white"> 
              <Text className="flex-1 font-rubikregular text-regular text-#404040 justify-center text-center px-8">This screen will show a list of upcoming Fly-ins, airshows, and other General Aviation Events</Text>        
        </View>  
    </ScrollView>
  </SafeAreaView>
  )
}

export default Flights