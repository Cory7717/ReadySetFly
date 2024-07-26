import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  onPressIn,
  onPressOut,
} from "react-native";
import React, { useState, useRef } from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import SocialMediaPost from "../../components/SocialMediaPost";
import CreateNewPost from "../../components/CreateNewPost";
import { Ionicons } from "@expo/vector-icons";

// const buttonScale = useRef(new Animated.Value(1)).current;

const addPost = (newPost) => {
  setPosts((prevPosts) => [...prevPosts, newPost]);
};

// const handlePressIn = (onPress) => {
// Animated.timing(buttonScale, {
//   toValue: 0.5, // Scale down to 50% of original size
//   duration: 200, // Duration of the animation
//   useNativeDriver: true, // Use native driver for better performance
// }).start();
// setIsMinimized(true);
// };

// const handlePressOut = () => {
// Animated.timing(buttonScale, {
//   toValue: 1, // Scale back to original size
//   duration: 200, // Duration of the animation
//   useNativeDriver: true, // Use native driver for better performance
// }).start();
// setIsMinimized(false);
// };

const samplePost = {
  profileImage: "https://example.com/profile.jpg",
  userName: "John Doe",
  time: "2 hours ago",
  content: "This is a sample post content.",
  image: "../../Assets/images/icononly_nobuffer.png",
  likes: 120,
  comments: 45,
};

const post = {
  profileImage: "https://example.com/profile.jpg",
  userName: "Cory Armer",
  time: "2 hours ago",
  content: "Time to get rich",
  image: "https://example.com/post-image.jpg",
  likes: 120,
  comments: 45,
};

const post1 = {
  profileImage: "https://example.com/profile.jpg",
  userName: "Amy Armer",
  time: "2 hours ago",
  content: "I have the hottest husband",
  image: "https://example.com/post-image.jpg",
  likes: 10000,
  comments: 8500,
};

const Flights = () => {
  const [posts, setPosts] = useState(samplePost);

  const addPost = (newPost) => {
    setPosts((prevPosts) => [...prevPosts, newPost]);
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-100">
      <ScrollView className="p-4">
        <Text className="text-2xl text-emerald-700 font-rubikblack mb-3">Ready, Set, Fly!</Text>
        <SocialMediaPost post={samplePost} />
        <SocialMediaPost post={post} />
        <SocialMediaPost post={post1} />
        <SocialMediaPost post={samplePost} />

        {/* Add more <SocialMediaPost /> components as needed */}
      </ScrollView>
      {Array.isArray(posts) && posts.length > 0 ? (
        posts.map((post, index) => <SocialMediaPost key={index} post={post} />)
      ) : (
        <TouchableOpacity onPressIn={onPressIn} onPressOut={onPressOut}>
          <View className="flex-row gap-4 ml-2">
            <Ionicons
              name="chevron-down-circle-outline"
              size={28}
              color="green"
            />
            <Text className="text-xl font-rubikblack pl-12 text-emerald-700">
              Add new post
            </Text>
          </View>
        </TouchableOpacity>
      )}
      <CreateNewPost onSubmit={addPost} />
    </SafeAreaView>
  );
};

export default Flights;
