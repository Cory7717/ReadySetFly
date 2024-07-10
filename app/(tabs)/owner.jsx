import { View, Text, ScrollView } from 'react-native'
import React from 'react'
import { Stack, Tabs } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

const Create = () => {
  return (
    <SafeAreaView className="h-full bg-white sand">
      <ScrollView contentContainerStyle={{height: "100%"}}>
      <View className="flex-1 items-center justify-normal pt-10 bg-white"> 
            <Text className="font-rubikblack text-4xl text-teal-400">Owner Profile!</Text> 
          </View> 
        <View className="flex-1 items-center bg-white"> 
              <Text className="flex-1 font-rubikregular text-regular text-teal-400 justify-center text-center px-8 ">This screen will be used for owner to set up their profiles and upload the details of the aircraft they own.</Text>        
        </View> 
      </ScrollView>
  </SafeAreaView>
  )
}

export default Create