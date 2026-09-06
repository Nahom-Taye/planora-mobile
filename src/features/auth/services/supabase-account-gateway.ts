import 'react-native-url-polyfill/auto';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';

import { createAccountClientFactory } from './account-client.ts';
import { createAccountTransport } from './auth-runtime.ts';
import type { AuthConfiguration } from './auth-types.ts';
import { authSessionStorage } from './session-storage.ts';

const accounts = createAccountClientFactory({
  storage: authSessionStorage,
  fetch: createAccountTransport(fetch, async () => {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false && state.isInternetReachable !== false;
  }),
  crypto: {
    randomBytes: Crypto.getRandomBytesAsync,
    sha256Base64: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  },
});

export function getSupabaseClient(configuration: AuthConfiguration) {
  return accounts(configuration).client;
}

export function createSupabaseAccountGateway(configuration: AuthConfiguration) {
  return accounts(configuration).gateway;
}
