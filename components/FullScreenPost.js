import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { useNavigation } from '@react-navigation/native';

// Styled components
const Container = styled(View, 'flex-1 bg-white pt-5');
const PostImage = styled(Image, 'w-full h-64 rounded-lg mt-5');
const BackButton = styled(TouchableOpacity, 'p-4 bg-gray-200 rounded-full mt-5 left-4');

// FullScreenPost Component
const FullScreenPost = ({ route }) => {
  const { post } = route.params; // Get the post data from route params
  const navigation = useNavigation();

  const handleBackPress = () => {
    navigation.goBack();
  };

  return (
    <Container>
      
      <View className="p-4">
        <Text className="text-xl font-bold mb-2">{post.userName}</Text>
        {post.image && <PostImage source={{ uri: post.image }} />}
        <Text className="mt-4">{post.content}</Text>
        <BackButton onPress={handleBackPress}>
        <Text>Back</Text>
      </BackButton>
      </View>
    </Container>
  );
};

export default FullScreenPost;
