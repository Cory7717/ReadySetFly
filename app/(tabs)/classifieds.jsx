import { StyleSheet, Text, View, ScrollView } from 'react-native'
import React from 'react'
import { Stack, Tabs } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
// import CustomButton from "../components/CustomButton";
import { useGlobalContext } from '../../context/GlobalProvider'

const Classifieds = () => {
    const { isLoading, isLoggedIn } = useGlobalContext;
  if (!isLoading && isLoggedIn) return <Redirect href="/home" />;
  return (
    <SafeAreaView className="h-full bg-white sand">
    <ScrollView contentContainerStyle={{height: "100%"}}>
    <View className="flex-1 items-center justify-center bg-white"> 
            <Text className="font-rubikblack text-4xl text-teal-400 px-8">Classifieds</Text> 
          </View> 
        <View className="flex-1 items-center bg-white"> 
              <Text className="flex-1 font-rubikregular text-regular text-teal-400 justify-center text-center px-8">This screen is a temporary placeholder</Text>        
        </View>  
        {/* <CustomButton
          title="Click here to view content "
          handlePress={() => router.push("/home")}
          containerStyles="w-full mt-10 bg-black"
        /> */}
    </ScrollView>
  </SafeAreaView>
  )
}

export default Classifieds