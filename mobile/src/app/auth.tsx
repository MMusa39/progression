import { Redirect } from 'expo-router';

/**
 * Target of the OAuth redirect (progression://auth). The auth session normally
 * intercepts the redirect before navigation; if the OS hands the link to the
 * router instead, send the user home and let the auth guard take over.
 */
export default function AuthRedirect() {
  return <Redirect href="/" />;
}
