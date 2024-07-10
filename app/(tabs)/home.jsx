import { ScrollView, Text, View, Image, ImageBackground, FlatList } from 'react-native'
import React from 'react'
import { Stack, Tabs } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'


const Home = () => {
  return (
    <>
      <SafeAreaView className="h-full bg-white sand">
        <FlatList 
          // data={[{ id: 1}]}
          // keyExtractor={(item) => item.$id}
          // renderItem={({ item }) => (
          // <Text>{item.id}</Text>
          // )
          // }
          // ListHeaderComponent={() => (
          // {/* <View></View>
          // )} */}
        />
        <ScrollView contentContainerStyle={{height: "100%"}}>
        <View className="flex-1 items-center justify-normal pt-10 bg-white"> 
        <Image source={"./Assets/images/background.png"} />
        <Text className="font-rubikblack text-2xl text-teal-400">Home Screen!</Text> 
            
          </View>
          <View className="flex-1 items-center justify-normal bg-white"> 
            <Text className="font-rubikblack text-4xl text-teal-400">Home Screen!</Text> 
          </View> 
        </ScrollView>
      </SafeAreaView>
    </>
  )
}

export default Home

