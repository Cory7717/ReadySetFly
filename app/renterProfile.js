import { View, Text, SafeAreaView, ScrollView } from 'react-native'
import React from 'react'
import RenterProfile from '../components/RenterProfile'

const renterProfile = () => {
  return (
    <SafeAreaView>
    <ScrollView>
      <View className="flex-1 items-center justify-center bg-white">
          <Text className="font-rubikblack text-4xl text-center text-#404040 px-8">
            Renter Dashboard
          </Text>
        </View>
    </ScrollView>
    </SafeAreaView>
  )
}

export default renterProfile