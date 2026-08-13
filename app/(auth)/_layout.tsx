import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack initialRouteName="sign-in" screenOptions={{ headerShown: false }} />
  );
}
