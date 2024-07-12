// src/MessageList.js

import React from 'react';
import { FlatList, View, Text } from 'react-native';
import { tw } from 'nativewind';

const MessageList = ({ messages }) => {
  const renderItem = ({ item }) => (
    <View style={tw`p-4 my-2 rounded bg-blue-100`}>
      <Text style={tw`text-lg font-semibold`}>{item.sender}</Text>
      <Text style={tw`text-base`}>{item.text}</Text>
    </View>
  );

  return (
    <FlatList
      data={messages}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
    />
  );
};

export default MessageList;
