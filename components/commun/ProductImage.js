import React from "react";
import { View, Text, Image } from "react-native";
import { getProductImage } from "../../lib/productImages";
import { THEME } from "./theme";

export const ProductThumb = ({ name, size = 44 }) => {
  const img = getProductImage(name);
  return (
    <View style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center'
    }}>
      <Text style={{ fontSize: size * 0.5 }}>{img.emoji}</Text>
    </View>
  );
};

// Vignette produit : vraie photo (URL http/https ou data:) si disponible — ex.
// produits ajoutés depuis Boutiques — sinon repli sur la pastille emoji.
export const ProductImage = ({ uri, name, size = 44 }) => {
  const ok = uri && typeof uri === 'string' && (/^https?:\/\//i.test(uri) || uri.startsWith('data:'));
  if (ok) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: Math.max(10, Math.round(size * 0.28)), backgroundColor: THEME.subtle }}
        resizeMode="cover"
      />
    );
  }
  return <ProductThumb name={name} size={size} />;
};
