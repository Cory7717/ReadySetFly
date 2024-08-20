// FullScreenRental.js
import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';

const FullScreenRental = ({ route, navigation }) => {
  const { listing } = route.params;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="p-4">
        <Text className="text-2xl font-bold mb-4">{listing.title}</Text>
        <Image
          source={{ uri: listing.photo }}
          style={{ width: '100%', height: 300, borderRadius: 10, marginBottom: 20 }}
        />
        <Text className="text-lg mb-2">Price: {listing.price}</Text>
        <Text className="text-lg">{listing.description}</Text>
      </View>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        className="absolute top-10 right-5 p-2 bg-gray-800 rounded-full"
      >
        <Text className="text-white">Close</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default FullScreenRental;
