import React from 'react';
import { TouchableOpacity } from 'react-native';

const RepeatButton = ({ onPress, onLongAction, style, children }) => {
  const intervalRef = React.useRef(null);
  const cbRef = React.useRef(onLongAction);
  React.useEffect(() => { cbRef.current = onLongAction; }, [onLongAction]);
  React.useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  const startRepeat = () => {
    intervalRef.current = setInterval(() => { cbRef.current(); }, 80);
  };
  const stopRepeat = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={startRepeat}
      onPressOut={stopRepeat}
      delayLongPress={200}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
};

export default RepeatButton;
