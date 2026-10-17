import { CognitoError } from './cognito';

/**
 * Turns sign-in errors into short, human messages. Cognito's raw messages are
 * written for developers ("1 validation error detected: Value at 'password'...").
 */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof CognitoError)) {
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
  switch (error.code) {
    case 'UsernameExistsException':
      return 'An account with this email or phone number already exists. Try signing in instead.';
    case 'NotAuthorizedException':
      return 'Incorrect email/phone or password.';
    case 'UserNotFoundException':
      return 'No account found with that email or phone number.';
    case 'CodeMismatchException':
      return "That code isn't right. Check it and try again.";
    case 'ExpiredCodeException':
      return 'That code has expired. Request a new one.';
    case 'InvalidPasswordException':
      return 'Password must be at least 8 characters with an uppercase letter, a lowercase letter, and a number.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'CodeDeliveryFailureException':
      return "We couldn't send the verification code. Check the email or phone number.";
    case 'InvalidParameterException':
      return error.message.includes('phone')
        ? 'Enter a valid phone number including the country code.'
        : error.message;
    default:
      return error.message;
  }
}
