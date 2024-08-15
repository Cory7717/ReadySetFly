import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Styled components
const FullScreenContainer = styled(View, 'flex-1 bg-black justify-center items-center');
const FullScreenImage = styled(Image, 'w-full h-3/4');
const CloseButton = styled(TouchableOpacity, 'absolute top-10 right-10');

const FullScreenPost = ({ route }) => {
  const { post } = route.params;
  const navigation = useNavigation();

  return (
    <FullScreenContainer>
      {post.image && <FullScreenImage source={{ uri: post.image }} />}
      <CloseButton onPress={() => navigation.goBack()}>
        <Ionicons name="close-circle-outline" size={36} color="white" />
      </CloseButton>
      <Text className="text-white mt-4 p-4">{post.content}</Text>
    </FullScreenContainer>
  );
};

export default FullScreenPost;
