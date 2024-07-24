import React from 'react';
import { View, Text, Image, SafeAreaView, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { styled } from 'nativewind';

const PostContainer = styled(View, 'p-4 bg-white rounded-2xl shadow-md mb-4');
const PostHeader = styled(View, 'flex-row items-center mb-4');
const ProfileImage = styled(Image, 'w-10 h-10 rounded-full mr-4');
const UserName = styled(Text, 'font-bold text-lg');
const PostTime = styled(Text, 'text-gray-500 text-sm');
const PostContent = styled(Text, 'mb-4');
const PostImage = styled(Image, 'w-full h-60 rounded-lg');
const PostFooter = styled(View, 'flex-row justify-between mt-4');
const LikeButton = styled(View, 'flex-row items-center');
const CommentButton = styled(View, 'flex-row items-center pl-5');
const ShareButton = styled(View, 'flex-row items-center pl-5');

const SocialMediaPost = ({ post }) => {
  return (
   
    <PostContainer>
      <PostHeader>
      
        <ProfileImage source={{ uri: post.profileImage }} />
        <View>
          <UserName>{post.userName}</UserName>
          <PostTime>{post.time}</PostTime>
        </View>
      </PostHeader>
      <PostContent>{post.content}</PostContent>
      {post.image && <PostImage source={{ uri: post.image }} />}
      <PostFooter>
        <LikeButton >
          <FontAwesome name="heart-o" size={24} color="black" />
          <Text className="ml-2">{post.likes}</Text>
        </LikeButton>
        <CommentButton className='p-5'>
          <FontAwesome name="comment-o" size={24} color="black" />
          <Text className="ml-2 p-2">{post.comments}</Text>
        </CommentButton>
        <ShareButton>
          <FontAwesome name="share" size={24} color="black" />
          <Text className="ml-2">Share</Text>
        </ShareButton>
      </PostFooter>
    </PostContainer>
   
  );
};

export default SocialMediaPost;
