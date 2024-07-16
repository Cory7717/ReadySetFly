// components/FormField.js
import React from 'react';
import { View, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from 'nativewind';

const FormField = ({ icon, placeholder, ...props }) => {
  return (
    <View style={tw`flex-row items-center border p-2 rounded`}>
      <MaterialIcons name={icon} size={24} style={tw`text-gray-400`} />
      <TextInput
        style={tw`ml-2 flex-1`}
        placeholder={placeholder}
        {...props}
      />
    </View>
  );
};

export default FormField;
