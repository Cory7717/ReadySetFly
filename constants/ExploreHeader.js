import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Header = ({ title }) => {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-blue-500 pt-4" style={{ paddingTop: insets.top }}>
      <Text className="text-white text-2xl font-bold text-center p-4">{title}</Text>
    </View>
  );
};

export default Header;

