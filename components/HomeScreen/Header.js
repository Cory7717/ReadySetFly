import { View, Text, Image, TextInput } from 'react-native'
import React from 'react'
import { useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons';
export default function Header() {
    const {user}=useUser();
  return (
   
    <View className="flex flex-row items-center gap-2">
        {/* User Info Section  */}
        <View >
            <Image source={{uri:user?.imageUrl}}
                className="rounded-full w-12 h-12"
            /> 
            <View>
                <Text className="text-[24px]">Welcome</Text>
                <Text className="text-[20px] font-bold">{user?.fullName}</Text>
            </View>
        </View>

        {/* Search bar  */}
        <View className="border">
        <Ionicons name="search" size={24} color="gray"  />
            <TextInput placeholder='Search' 
            className="flex-row ml-2 text-[18px]" 
            onChangeText={(value)=>console.log(value)}
            />
        </View>
    </View>
  
  )
}