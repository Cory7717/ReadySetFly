// App.js
import React from 'react';
import { View, Text, Image, TextInput } from 'react-native'
import { NativeWindStyleSheet } from "nativewind";
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons'

const Header = () => {
  const {user}=useUser();
  console.log(user);
  return (
    <View className="flex-row items-center gap-2 pt-5">
        <Image source={{uri:user?.imageUrl}} 
          className='rounded-full w-12 h-12'
        />
        <View>
                <Text className="text-[16px]">Welcome</Text>
                <Text className="text-[20px] font-bold">{user?.fullName}</Text>
            </View>
      {/* Other components */}
       {/* Search bar  */}

       <View className="p-[9px] px-5 flex-row 
        items-center  bg-blue-50 mt-5 rounded-full 
        border-[1px] border-blue-300">
        <Ionicons name="search" size={24} color="gray"  />
        <View>
            <TextInput placeholder='Search' 
            className="ml-2 text-[18px]" 
            onChangeText={(value)=>console.log(value)}
            />
            </View>
        </View>
    </View>
  );
};

export default Header;
