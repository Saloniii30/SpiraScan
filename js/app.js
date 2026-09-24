import { getAuthClient, isAuthConfigured } from './auth.js';

const headerLogin = document.querySelector('.header-login');

function showLoggedInUser(email) {
  if (!headerLogin) return;

  headerLogin.className = 'header-account';
  headerLogin.href = '#';
  headerLogin.title = email ? `Signed in as ${email}` : 'Signed in';

  headerLogin.innerHTML = `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      class="account-icon"
    >
      <circle cx="12" cy="8" r="3.5"></circle>
      <path d="M5 20c.8-3.5 3.2-5.5 7-5.5s6.2 2 7 5.5"></path>
    </svg>
    <span class="sr-only">Signed in</span>
  `;

  headerLogin.addEventListener('click', async (event) => {
    event.preventDefault();

    try {
      const client = await getAuthClient();
      const { error } = await client.auth.signOut();

      if (error) {
        console.error('Sign out failed:', error);
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  });
}

function showLoggedOutUser() {
  if (!headerLogin) return;

  headerLogin.className = 'button button-outline header-login';
  headerLogin.href = 'login.html';
  headerLogin.title = 'Sign in';
  headerLogin.innerHTML = `
    <span aria-hidden="true">♙</span>
    Login
  `;
}

async function initializeHeaderAuth() {
  if (!headerLogin || !isAuthConfigured()) return;

  try {
    const client = await getAuthClient();

    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    if (data.session) {
      showLoggedInUser(data.session.user.email);
    } else {
      showLoggedOutUser();
    }

    client.auth.onAuthStateChange((event, session) => {
      if (session) {
        showLoggedInUser(session.user.email);
      } else if (event === 'SIGNED_OUT') {
        showLoggedOutUser();
      }
    });
  } catch (error) {
    console.error('Could not initialize header authentication:', error);
  }
}

initializeHeaderAuth();
function createSpiral(isUneven) {
  const points = [];

  for (let step = 0; step <= 420; step += 1) {
    const angle = step * 0.045;
    const radius = 3 + step * 0.145;
    const variation = isUneven
      ? Math.sin(step * 1.7) * 1.9 + Math.sin(step * 0.32) * 2.1
      : 0;
    const x = 80 + Math.cos(angle) * (radius + variation);
    const y = 80 + Math.sin(angle) * (radius + variation);

    points.push(`${step === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return points.join(' ');
}

document.querySelector('.smooth-spiral').setAttribute('d', createSpiral(false));
document.querySelector('.uneven-spiral').setAttribute('d', createSpiral(true));
document.querySelector('[data-year]').textContent = new Date().getFullYear();

const dialog = document.querySelector('#information-dialog');
const dialogTitle = document.querySelector('#dialog-title');
const dialogContent = document.querySelector('#dialog-content');

const explanations = {
  causes: {
    title: 'How does Parkinson’s develop?',
    content: `
      <p>
        Parkinson’s involves changes in several brain systems, including the loss of
        dopamine-producing cells in the substantia nigra. Dopamine helps the brain coordinate
        movement.
      </p>
      <p>
        The cause is not fully understood. Aging, genetic factors, and environmental
        exposures can contribute. Having a risk factor does not mean someone will develop
        Parkinson’s.
      </p>
    `
  },
  impact: {
    title: 'Understanding the everyday impact',
    content: `
      <p>
        Parkinson’s can affect walking, writing, speaking, and other daily activities. Sleep
        problems, changes in mood, and other non-movement symptoms can also occur.
      </p>
      <p>
        Symptoms and progression vary from person to person. Professional care and support
        can help people manage symptoms and maintain quality of life.
      </p>
    `
  },
  symptoms: {
    title: 'Know the signs. Start a conversation.',
    content: `
      <p>
        Signs can include tremor, slower movement, stiffness, and changes in balance,
        handwriting, or speech. Some people also experience sleep, mood, or other
        non-movement changes.
      </p>
      <p>
        These symptoms can have other causes. A drawing or a symptom checklist cannot
        establish a diagnosis. If you notice persistent changes, discuss them with a
        healthcare professional.
      </p>
    `
  }
};

function openInformation(title, content) {
  dialogTitle.textContent = title;
  // Content comes only from the fixed explanations in this file, never user input.
  dialogContent.innerHTML = content;
  dialog.showModal();
}

document.querySelectorAll('[data-how-it-works]').forEach((button) => {
  button.addEventListener('click', () => {
    openInformation('From a simple spiral to a little insight', `
      <ol class="steps">
        <li>
          <strong>
            Choose a drawing
          </strong>
          Open the image workspace without signing in. Select a JPEG, PNG, or WebP image.
        </li>
        <li>
          <strong>
            Check your original
          </strong>
          Preview the image and choose rotation, noise reduction, and threshold settings.
        </li>
        <li>
          <strong>
            Review every processing stage
          </strong>
          OpenCV produces grayscale, threshold, cleaned drawing, edge, and contour previews.
          Compare the stages, enlarge an image, and download PNG files or a review report.
        </li>
        <li>
          <strong>
            Take an informed next step
          </strong>
          Discuss concerns with a healthcare professional. A spiral alone cannot diagnose
          Parkinson’s.
        </li>
      </ol>
      <p class="dialog-note">
        Image preprocessing runs locally without an account. Supabase authentication and
        disease prediction are not part of this workflow.
      </p>
      <a class="button button-primary" href="workspace.html">
        Open Image Workspace
        <span aria-hidden="true">
          →
        </span>
      </a>
    `);
  });
});

document.querySelectorAll('[data-detail]').forEach((button) => {
  button.addEventListener('click', () => {
    const explanation = explanations[button.dataset.detail];
    openInformation(explanation.title, explanation.content);
  });
});

document.querySelector('.dialog-close').addEventListener('click', () => {
  dialog.close();
});

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (outside) {
      dialog.close();
    }
  }
});
