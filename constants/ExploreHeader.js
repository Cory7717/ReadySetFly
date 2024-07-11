// components/CustomHeader.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import tw from 'nativewind';

const CustomHeader = ({ title }) => {
  const navigation = useNavigation();

  return (
    <View style={tw`flex-row items-center justify-between p-4 bg-blue-600`}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-2`}>
        <Text style={tw`text-white`}>Back</Text>
      </TouchableOpacity>
      <Text style={tw`text-white text-lg font-bold`}>{title}</Text>
      <View style={tw`p-2`} />
    </View>
  );
};

export default CustomHeader;

