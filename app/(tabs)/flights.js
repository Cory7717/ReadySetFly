import { Text, View, ScrollView } from 'react-native'
import React from 'react'
import { Stack, Tabs } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import SocialMediaPost from '../../components/SocialMediaPost'

const samplePost = {
  profileImage: 'https://example.com/profile.jpg',
  userName: 'John Doe',
  time: '2 hours ago',
  content: 'This is a sample post content.',
  image: '../../Assets/images/icononly_nobuffer.png',
  likes: 120,
  comments: 45,
};

const post = {
  profileImage: 'https://example.com/profile.jpg',
  userName: 'Cory Armer',
  time: '2 hours ago',
  content: 'Time to get rich',
  image: 'https://example.com/post-image.jpg',
  likes: 120,
  comments: 45,
}

const post1 = {
  profileImage: 'https://example.com/profile.jpg',
  userName: 'Amy Armer',
  time: '2 hours ago',
  content: 'I have the hottest husband',
  image: 'https://example.com/post-image.jpg',
  likes:10000,
  comments: 8500,
}

const Flights = () => {
  return (
    <SafeAreaView className="flex-1 bg-grey">
      <ScrollView className="p-4">
        <SocialMediaPost post={samplePost} />
        <SocialMediaPost post={post} />
        <SocialMediaPost post={post1} />
        <SocialMediaPost post={samplePost} />
        <SocialMediaPost post={samplePost} />
        <SocialMediaPost post={samplePost} />
        <SocialMediaPost post={samplePost} />
        <SocialMediaPost post={samplePost} />
        <SocialMediaPost post={samplePost} />
        <SocialMediaPost post={samplePost} />
        {/* Add more <SocialMediaPost /> components as needed */}
      </ScrollView>
    </SafeAreaView>
  );
}

export default Flights