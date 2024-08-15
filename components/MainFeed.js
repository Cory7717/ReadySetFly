import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { styled } from 'nativewind';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import CreateNewPost from './CreateNewPost';
import Post from './Post';

// Styled components
const Container = styled(SafeAreaView, 'flex-1 bg-gray-100');
const Header = styled(View, 'p-4 bg-white flex-row items-center');
const PostButton = styled(TouchableOpacity, 'p-4 bg-blue-500 rounded-lg absolute bottom-4 left-4 right-4 flex-row items-center justify-center');
const PostButtonText = styled(Text, 'text-white text-xl text-center ml-2');

const MainFeed = () => {
  const [posts, setPosts] = useState([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(fetchedPosts);
    });

    return () => unsubscribe();
  }, []);

  const handleCreatePost = () => {
    setIsCreatingPost(true);
  };

  const handleCancelPost = () => {
    setIsCreatingPost(false);
  };

  const handleSubmitPost = (newPost) => {
    setIsCreatingPost(false);
    setPosts((prevPosts) => [newPost, ...prevPosts]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate a refresh by refetching posts (or any other logic)
    setRefreshing(false);
  };

  return (
    <Container>
      <Header className='pt-5'>
        <Text className='text-center text-lg font-bold flex-1'>Social Media App</Text>
      </Header>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {isCreatingPost ? (
          <CreateNewPost onSubmit={handleSubmitPost} onCancel={handleCancelPost} />
        ) : (
          posts.map((post) => <Post key={post.id} post={post} />)
        )}
      </ScrollView>
      {!isCreatingPost && (
        <PostButton onPress={handleCreatePost}>
          <Ionicons name="create" size={24} color="white" />
          <PostButtonText>Create Post</PostButtonText>
        </PostButton>
      )}
    </Container>
  );
};

export default MainFeed;
