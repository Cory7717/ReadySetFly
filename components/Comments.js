import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { styled } from 'nativewind';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';

// Styled components
const Container = styled(View, 'flex-1 bg-gray-100 p-4');
const CommentContainer = styled(View, 'bg-white p-4 mb-2 rounded-lg shadow');
const CommentInput = styled(TextInput, 'border border-gray-300 p-2 rounded-lg mb-2');
const CommentButton = styled(TouchableOpacity, 'bg-blue-500 p-2 rounded-lg');
const CommentButtonText = styled(Text, 'text-white text-center');

// CommentsScreen Component
const CommentsScreen = () => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params;

  useEffect(() => {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(fetchedComments);
    });

    return () => unsubscribe();
  }, [postId]);

  const handleAddComment = async () => {
    if (newComment.trim()) {
      const commentData = {
        text: newComment,
        createdAt: new Date(),
        userId: 'currentUserId', // Replace with actual user ID
        userName: 'Current User', // Replace with actual user name
      };
      try {
        await addDoc(collection(db, 'posts', postId, 'comments'), commentData);
        setNewComment('');
      } catch (error) {
        Alert.alert('Error', 'Could not add comment.');
      }
    } else {
      Alert.alert('Error', 'Comment cannot be empty.');
    }
  };

  const renderItem = ({ item }) => (
    <CommentContainer>
      <Text style={{ fontWeight: 'bold' }}>{item.userName}</Text>
      <Text>{item.text}</Text>
    </CommentContainer>
  );

  return (
    <Container>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text>No comments yet.</Text>}
      />
      <CommentInput
        placeholder="Add a comment..."
        value={newComment}
        onChangeText={setNewComment}
      />
      <CommentButton onPress={handleAddComment}>
        <CommentButtonText>Add Comment</CommentButtonText>
      </CommentButton>
    </Container>
  );
};

export default CommentsScreen;
