import { getAuthClient, getLoginUrl, isAuthConfigured } from './auth.js';

const form = document.querySelector('#auth-form');
const password = document.querySelector('#password');
const message = document.querySelector('#auth-message');
const submitButton = document.querySelector('#submit-button');
const switchButton = document.querySelector('#switch-mode');
let mode = 'signin';

// Keep the text for each form together so it is easy to edit.
const formLabels = {
  signin: {
    title: 'Welcome back',
    description: 'Sign in to your SpiraScan account.',
    button: 'Sign In →'
  },
  signup: {
    title: 'Create your account',
    description: 'Take your first step with SpiraScan.',
    button: 'Create Account'
  },
  reset: {
    title: 'Reset your password',
    description: 'We’ll email you a secure recovery link.',
    button: 'Send Reset Link'
  },
  update: {
    title: 'Choose a new password',
    description: 'Enter a new password with at least 8 characters.',
    button: 'Save Password'
  }
};

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

function setMode(nextMode) {
  mode = nextMode;
  const isReset = mode === 'reset';
  const isSignup = mode === 'signup';
  const isUpdate = mode === 'update';

  const labels = formLabels[mode];

  document.querySelector('#auth-title').textContent = labels.title;
  document.querySelector('#auth-description').textContent = labels.description;
  document.querySelector('#password-field').hidden = isReset;
  document.querySelector('#email').hidden = isUpdate;
  document.querySelector('label[for="email"]').hidden = isUpdate;
  document.querySelector('#email').required = !isUpdate;
  password.required = !isReset;
  password.autocomplete = isSignup || isUpdate ? 'new-password' : 'current-password';
  password.value = '';
  document.querySelector('#forgot-password').hidden = mode !== 'signin';
  submitButton.textContent = labels.button;
  document.querySelector('#switch-description').textContent = mode === 'signin'
    ? 'New to SpiraScan?'
    : 'Already have an account?';
  switchButton.textContent = mode === 'signin' ? 'Create an account' : 'Sign in';
  showMessage('');
}

function showAccount(isSignedIn) {
  form.hidden = isSignedIn;
  document.querySelector('.auth-switch').hidden = isSignedIn;
  document.querySelector('#account-panel').hidden = !isSignedIn;
  if (isSignedIn) {
    document.querySelector('#auth-title').textContent = 'You’re signed in';
    document.querySelector('#auth-description').textContent = 'Welcome to SpiraScan.';
  }
}

switchButton.addEventListener('click', () => {
  setMode(mode === 'signin' ? 'signup' : 'signin');
});

document.querySelector('#forgot-password').addEventListener('click', () => {
  setMode('reset');
});

document.querySelector('#toggle-password').addEventListener('click', (event) => {
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  event.currentTarget.textContent = show ? 'Hide' : 'Show';
  event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  form.setAttribute('aria-busy', 'true');
  showMessage('Please wait…');

  try {
    const client = await getAuthClient();
    const email = document.querySelector('#email').value.trim();
    let result;

    if (mode === 'signup') {
      result = await client.auth.signUp({
        email,
        password: password.value,
        options: {
          emailRedirectTo: getLoginUrl()
        }
      });
    } else if (mode === 'reset') {
      result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: getLoginUrl()
      });
    } else if (mode === 'update') {
      result = await client.auth.updateUser({
        password: password.value
      });
    } else {
      result = await client.auth.signInWithPassword({
        email,
        password: password.value
      });
    }

    if (result.error) {
      throw result.error;
    }

    if (mode === 'reset') {
      showMessage('If an account exists for that email, you’ll receive a password reset link.');
    } else if (mode === 'signup' && !result.data.session) {
      showMessage('Check your email for the next steps to confirm your account.');
    } else {
      showAccount(true);
    }
    password.value = '';
  } catch (error) {
    showMessage(error.message || 'Unable to connect. Please try again.', true);
  } finally {
    submitButton.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

document.querySelector('#sign-out').addEventListener('click', async () => {
  try {
    const client = await getAuthClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
    showAccount(false);
    setMode('signin');
  } catch (error) {
    document.querySelector('#account-panel p').textContent = `Could not sign out: ${error.message}`;
  }
});

async function initializeAuth() {
  document.querySelector('#configuration-note').hidden = isAuthConfigured();
  if (!isAuthConfigured()) {
    return;
  }

  try {
    const client = await getAuthClient();
    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        showAccount(false);
        setMode('update');
      }
      if (event === 'SIGNED_OUT') {
        showAccount(false);
        setMode('signin');
      }
    });

    const { data, error } = await client.auth.getSession();
    if (error) {
      throw error;
    }

    if (data.session && mode !== 'update') {
      showAccount(true);
    }
  } catch (error) {
    showMessage(`Could not initialize authentication: ${error.message}`, true);
  }
}

initializeAuth();
