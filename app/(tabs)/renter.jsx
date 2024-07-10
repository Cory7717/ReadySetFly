import { Text, View, Image, FlatList, TouchableOpacity, ScrollView } from 'react-native'
import React from 'react'
import { SplashScreen, Stack } from 'expo-router'
import "react-native-url-polyfill/auto";
import { SafeAreaView } from 'react-native-safe-area-context';

const Profile = () => {
  return (
    <SafeAreaView className="h-full bg-white sand">
        <ScrollView contentContainerStyle={{height: "100%"}}>
        <View className="flex-1 items-center justify-normal pt-10 border-black-100 bg-white"> 
            <Text className="font-rubikblack text-4xl text-teal-400">Renter Profile!</Text> 
          </View> 
        <View className="flex-1 items-center bg-white"> 
              <Text className="flex-1 font-rubikregular text-regular text-teal-400 justify-center text-center px-8 ">This screen will be used for renters to upload their pilot certifications.</Text>        
        </View>  
        </ScrollView>
      </SafeAreaView>
  )
}

export default Profile