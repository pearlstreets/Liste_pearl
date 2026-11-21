import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "../ui/IoniconsSens";
import { styles } from "./styles";

export const Square = ({ value, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.square, value && styles.squareOn]}>
    {value ? <Ionicons name="checkmark" size={14} color="#1C1917" /> : null}
  </TouchableOpacity>
);
export const Radio = ({ value, onPress, style }) => {
  const Cmp = onPress ? TouchableOpacity : View;
  return (
    <Cmp onPress={onPress} style={[styles.radioOuter, value && { borderColor: '#DCC9B8', backgroundColor: '#FFFFFF' }, style]}>
      {value ? <Ionicons name="checkmark" size={14} color="#1C1917" /> : null}
    </Cmp>
  );
};
