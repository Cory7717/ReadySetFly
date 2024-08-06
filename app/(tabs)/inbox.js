import { Stack, Tabs } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MessageList from '../../components/MessageList.js';
import SendMessage from '../../components/SendMessage.js';
import tw from 'nativewind';


import { createStackNavigator } from '@react-navigation/native';
const Inbox = () => {

    

    return (
    <SafeAreaView className="h-full bg-white sand">
    <ScrollView contentContainerStyle={{height: "100%"}}>
    <View>
      {/* <Text>Inbox Screen</Text>
      <SendMessage /> */}
    </View>
    
    <View className="flex-1 items-center justify-center bg-white"> 
            <Text className="font-rubikblack text-4xl text-#404040 px-8">Inbox</Text> 
          </View> 
        <View className="flex-1 items-center bg-white"> 
              <Text className="flex-1 font-rubikregular text-regular text-#404040 justify-center text-center px-8">This screen is a temporary placeholder</Text>        
        </View>  
    </ScrollView>
  </SafeAreaView>
  )
}

export default Inbox

