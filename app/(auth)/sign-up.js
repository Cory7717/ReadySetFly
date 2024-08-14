import React from 'react';
import { View, Text, ScrollView, Dimensions, Alert, Image, TextInput, Button } from 'react-native';
import { useState } from 'react';
import { Link, router, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { images } from "../../constants";
import FormField from '../../components/FormField';
import CustomButton from '../../components/CustomButton';
import { StatusBar } from 'expo-status-bar';
import { createUser, setUser } from '../../lib/appwrite';
import { signUp } from '../../lib/appwrite';
import { useGlobalContext } from '../../context/GlobalProvider';
import { SignedIn, SignedOut, useUser, useSignUp } from '@clerk/clerk-expo'



const SignUp = () => {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [pendingVerification, setPendingVerification] = React.useState(false)
  const [code, setCode] = React.useState('')

  const onSignUpPress = async () => {
    if (!isLoaded) {
      return
    }

    try {
      await signUp.create({
        emailAddress,
        password,
      })

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

      setPendingVerification(true)
    } catch (err) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2))
    }
  }

  const onPressVerify = async () => {
    if (!isLoaded) {
      return
    }

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      })

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId })
        router.replace('/')
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2))
      }
    } catch (err) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2))
    }
  }
  
  
  
  
  // const { setUser, setIsLogged } = useGlobalContext();
  // const [isSubmitting, setSubmitting] = useState(false)
  // const [form, setForm] = useState({
  //   username: "",
  //   email: "",
  //   password: "",
  // });

  
  
  // const submit = async () => {
  //   if(form.email ==="" || form.password ==="") {
  //     Alert.alert('Error', 'Please fill in the required fields')
  //   }

  //   setSubmitting(true);
    
  //   try {
  //     const result = await createUser(form.email, form.password, form.username);
  //     setUser(result);
  //     setIsLogged(true);

  //     router.replace('/home');
  //   } catch (error) {
  //       Alert.alert('Error', error.message)
  //   }  finally {
      
  //     setSubmitting(false);
  //   }
  // };

  return (
    <SafeAreaView className="bg-white h-full">
      <ScrollView> 
        <View className="w-full justify-center items-center px-4 ">
          <Image source={images.logo}
            resizeMode='contain'
            className='w-[300px] h-[300px]'
            
          />
        </View>

        <View>
      {!pendingVerification && (
        <>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email..."
            onChangeText={(email) => setEmailAddress(email)}
          />
          <TextInput
            value={password}
            placeholder="Password..."
            secureTextEntry={true}
            onChangeText={(password) => setPassword(password)}
          />
          <Button title="Sign Up" onPress={onSignUpPress} />
        </>
      )}
      {pendingVerification && (
        <>
          <TextInput value={code} placeholder="Code..." onChangeText={(code) => setCode(code)} />
          <Button title="Verify Email" onPress={onPressVerify} />
        </>
      )}
    </View>

        {/* <View className=' mt-1 justify-center items-center'>
          <Text className='text-2xl font-rubikblack justify-center items-center'>
            Sign up for Ready, Set, Fly!
          </Text>
          <FormField
            title="Username"
            value={form.username}
            handleChangeText={(e) => setForm({...form, username: e })}
            otherStyles='mt-10 mx-5'
            
          />   
          <FormField
            title="Email"
            value={form.email}
            handleChangeText={(e) => setForm({...form, email: e })}
            otherStyles='mt-7 mx-5'
            keyboardType="email-address"
          />     
          <FormField 
          title="Password"
          value={form.password}
          handleChangeText={(e) => setForm({...form, password: e })}    
          otherStyles='mt-7 mx-5'
          /> 
        <CustomButton
          title='Sign-Up'
          handlePress={submit}
          containerStyles='mt-7 bg-black w-100% ' 
          isLoading={isSubmitting}         
           />
           <View className='justify-center pt-5 flex-row gap-2'>
           <Text className='text-lg font-rubikregular text-#404040'>
            Already have an account? 
           </Text>
            <Link href='/sign-in' className='text-lg font-rubikbold text-emerald-700'>Sign In
            </Link>
           </View>
         
        </View> */}
      </ScrollView>
      <StatusBar backgroundColor='white' />
    </SafeAreaView>
  )
}

export default SignUp
