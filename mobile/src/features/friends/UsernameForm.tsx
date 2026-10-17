/**
 * Pick or change your @username. Friends find you by it, so the Friends tab
 * asks for it before anything else.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text, TextField } from '@/components/ui';
import { useUpdateMe } from '@/features/api/queries';
import { space } from '@/theme/tokens';

const PATTERN = /^[a-z0-9_.]{3,20}$/;

export function UsernameForm({ current, onSaved, submitLabel = 'Save username' }: {
  current?: string | null;
  onSaved?: () => void;
  submitLabel?: string;
}) {
  const update = useUpdateMe();
  const [value, setValue] = useState(current ?? '');
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  const valid = PATTERN.test(normalized);
  const unchanged = normalized === (current ?? '');

  return (
    <View style={{ gap: space.md }}>
      <TextField
        label="Username"
        value={value}
        onChangeText={setValue}
        placeholder="e.g. mike_lifts"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={21}
        prefix={<Text variant="body" color="textTertiary">@</Text>}
        error={update.error?.message ?? (value && !valid ? '3–20 characters: letters, numbers, underscores, dots.' : null)}
        hint="Friends search for you by this."
        onSubmitEditing={() => valid && update.mutate({ username: normalized }, { onSuccess: onSaved })}
        returnKeyType="done"
      />
      <Button
        title={submitLabel}
        onPress={() => update.mutate({ username: normalized }, { onSuccess: onSaved })}
        disabled={!valid || unchanged}
        loading={update.isPending}
      />
    </View>
  );
}
