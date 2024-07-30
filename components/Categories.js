import { View, Text, FlatList } from 'react-native'
import React from 'react'


const Categories = (categoryList) => {
  return (
    <View>
     <FlatList
      data={categoryList}
      horizontal="true"
      showsHorizontalScrollIndicator={false}
      renderItem={({item, index }) => (
        <View>
       <Image source={{uri:item?.Image}}
          className="h=[200px] w-[30px]"
           />
        </View>
      )}
     />
    </View>
  )
}

export default Categories