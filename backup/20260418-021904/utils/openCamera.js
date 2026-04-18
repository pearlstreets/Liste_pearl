import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import i18n from '../i18n';
export async function openCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(i18n.t('camera.permissionDenied'), i18n.t('camera.enableCameraSettings'));
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
  });
  if (res?.canceled) return null;
  return res.assets?.[0]?.uri || null;
}
