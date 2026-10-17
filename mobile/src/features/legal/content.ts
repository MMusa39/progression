/**
 * Privacy policy and terms, shown in the app. docs/legal/ has the same text for
 * hosting at a public URL (the App Store needs one); a test keeps their
 * headings in step.
 */
export type LegalDocument = { title: string; updated: string; intro: string; sections: { heading: string; body: string[] }[] };

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  updated: 'October 17, 2026',
  intro:
    'Progression is a workout, body-weight and nutrition tracker. This policy explains what we store, why, and the control you have over it. The short version: we keep what you log so the app can show your progress, we never sell it or use it for advertising, and you can export or delete all of it from the app at any time.',
  sections: [
    {
      heading: 'What we collect',
      body: [
        'Account details: your email address or phone number, or your name and email from Google if you sign in with Google. Passwords are handled by Amazon Cognito and never reach our servers.',
        'What you log: workouts (exercises, sets, weights, reps, notes), body-weight entries, food diary entries, recipes, custom foods and water intake.',
        'Plan details, if you set up a nutrition plan: sex, birth year, height, goal weight, goal date and activity level. These are used only to calculate your targets.',
        'Social details, if you use friends: your username, friend connections and your choice of what to share.',
        'A push notification token for your device, if you allow notifications.',
      ],
    },
    {
      heading: 'What we don’t collect',
      body: [
        'No advertising identifiers, no third-party analytics or tracking, and no location.',
        'The camera is used only to read food barcodes. Images never leave your phone; only the barcode number is sent.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        'To run the app: show your history, charts, records, targets and trends, and sync your data between sessions.',
        'To send notifications you’ve turned on (friend requests, friends’ personal records, rest timer).',
        'We don’t sell your data, share it with advertisers, or use it to train models.',
      ],
    },
    {
      heading: 'Who can see it',
      body: [
        'Friends you accept can see your personal records and streak, and your workouts unless you switch "Share workouts" off. They never see your body weight, food diary or plan.',
        'Recipes are private unless you switch on "Share with friends" for a recipe. Friends can then view it and save their own copy.',
        'Service providers that run parts of the app process data on our behalf: Amazon Web Services (hosting and sign-in), Google (only if you sign in with Google), and Expo (delivering push notifications). Barcode lookups are sent from our server to Open Food Facts without any information about you.',
        'We may disclose data if required by law.',
      ],
    },
    {
      heading: 'Where it’s stored and how long',
      body: [
        'Data is stored on Amazon Web Services in the United States, encrypted in transit and at rest.',
        'We keep your data until you delete it or your account. Deleting your account removes it from our database immediately; encrypted backups are overwritten within 35 days.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'Export: Profile → Export my data gives you a copy of everything as a JSON file.',
        'Delete: Profile → Delete account permanently removes your account and all of your data.',
        'You can change sharing and notification settings in Profile at any time.',
      ],
    },
    {
      heading: 'Children',
      body: ['Progression is not intended for children under 13, and we don’t knowingly collect data from them.'],
    },
    {
      heading: 'Changes and contact',
      body: [
        'If this policy changes, we’ll update the date above and, for significant changes, tell you in the app.',
        'Questions or requests: contact us through the support link on the App Store listing.',
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: 'Terms of Use',
  updated: 'October 17, 2026',
  intro: 'By using Progression you agree to these terms. Please read them; they’re short.',
  sections: [
    {
      heading: 'Not medical advice',
      body: [
        'Calorie, macro and training information in Progression is general guidance based on standard formulas. It is not medical, nutritional or fitness advice. Talk to a qualified professional before changing your diet or training, especially if you have a health condition, are pregnant, or have a history of disordered eating.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'Keep your sign-in details secure; you’re responsible for activity on your account. You must be at least 13 years old.',
        'You own what you log. You give us permission to store and process it only to provide the app to you and the friends you choose to share with.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        'Don’t misuse the service: no attempts to access other people’s data, overload or disrupt the service, or use usernames, recipes or content that are offensive or infringe others’ rights.',
        'We may suspend accounts that break these rules.',
      ],
    },
    {
      heading: 'The service',
      body: [
        'We work to keep Progression available and your data safe, but the app is provided "as is", without warranties. Food information from Open Food Facts and user-created foods may contain errors.',
        'To the extent the law allows, we aren’t liable for indirect losses or for decisions made based on information in the app.',
      ],
    },
    {
      heading: 'Changes',
      body: ['We may update these terms. If we make significant changes, we’ll tell you in the app. Continuing to use Progression means you accept the updated terms.'],
    },
  ],
};
