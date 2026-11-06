export interface ProfileFormValues {
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUri: string;
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

const AVATAR_URL_PATTERN = /^https?:\/\/\S+$/i;

/**
 * RF-14 (T-094): validates the editable profile/account fields before saving.
 * Username and email reuse the same format rules as registration so an edited
 * account can never end up in a state sign-up would have rejected.
 */
export function validateProfileForm(values: ProfileFormValues): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  const username = values.username.trim();
  const email = values.email.trim();
  const displayName = values.displayName.trim();
  const avatarUri = values.avatarUri.trim();

  if (username.length < 3 || username.length > 24 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
    errors.username = 'Use 3–24 letters, numbers, dots, underscores or hyphens.';
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (displayName.length === 0) {
    errors.displayName = 'Enter a display name.';
  } else if (displayName.length > 40) {
    errors.displayName = 'Keep the display name under 40 characters.';
  }
  if (values.bio.length > 280) {
    errors.bio = 'Keep the description under 280 characters.';
  }
  if (avatarUri.length > 0 && !AVATAR_URL_PATTERN.test(avatarUri)) {
    errors.avatarUri = 'Enter a valid image URL starting with http:// or https://.';
  }

  return errors;
}
