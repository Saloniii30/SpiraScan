// This page sends images only to the local Node server, never to Supabase.
const fileInput = document.querySelector('#image-file');
const dropZone = document.querySelector('#drop-zone');
const processButton = document.querySelector('#process-button');
const reportButton = document.querySelector('#report-button');
const status = document.querySelector('#processing-status');
const sourceImage = document.querySelector('#source-image');
const results = document.querySelector('#results');
const imageDialog = document.querySelector('#image-dialog');

let selectedFile = null;
let sourceUrl = null;
let currentReport = null;
let isBusy = false;
let selectionVersion = 0;

function setStatus(text, isError = false) {
  status.textContent = text;
  status.classList.toggle('error', isError);
}

function resetResults() {
  currentReport = null;
  results.hidden = true;
  reportButton.disabled = true;
  document.querySelector('#stages').replaceChildren();
  document.querySelector('#metrics').replaceChildren();
  document.querySelector('#review-notes').replaceChildren();
}

function setBusy(busy) {
  isBusy = busy;
  processButton.disabled = busy || !selectedFile;
  processButton.textContent = busy ? 'Processing your image…' : 'Process with OpenCV';
  fileInput.disabled = busy;
  document.querySelector('#sample-button').disabled = busy;
  document.querySelector('#settings').disabled = busy;
  document.querySelector('#clear-button').disabled = busy;
  document.querySelector('.review-panel').setAttribute('aria-busy', String(busy));
}

function clearImage() {
  selectionVersion += 1;
  selectedFile = null;
  fileInput.value = '';

  if (sourceUrl) {
    URL.revokeObjectURL(sourceUrl);
    sourceUrl = null;
  }

  sourceImage.removeAttribute('src');
  document.querySelector('#source-preview').hidden = true;
  document.querySelector('#empty-preview').hidden = false;
  document.querySelector('#file-description').textContent = 'No image selected.';
  document.querySelector('#enlarged-image').removeAttribute('src');
  resetResults();
  setBusy(false);
  setStatus('Choose an image or try the sample to begin.');
}

async function selectImage(file) {
  if (isBusy) {
    return;
  }

  clearImage();
  const version = selectionVersion;
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!file || !acceptedTypes.includes(file.type)) {
    setStatus('Choose a JPEG, PNG, or WebP image.', true);
    return;
  }

  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    setStatus('Choose a non-empty image smaller than 10 MB.', true);
    return;
  }

  const candidateUrl = URL.createObjectURL(file);

  try {
    const preview = new Image();
    preview.src = candidateUrl;
    await preview.decode();

    if (version !== selectionVersion) {
      URL.revokeObjectURL(candidateUrl);
      return;
    }

    const width = preview.naturalWidth;
    const height = preview.naturalHeight;

    if (width * height > 20_000_000 || Math.min(width, height) < 64) {
      throw new Error('Use an image of at most 20 megapixels and at least 64 pixels per side.');
    }

    sourceUrl = candidateUrl;
    selectedFile = file;
    sourceImage.src = sourceUrl;
    document.querySelector('#source-preview').hidden = false;
    document.querySelector('#empty-preview').hidden = true;
    document.querySelector('#file-description').textContent =
      `${file.name} · ${width} × ${height} pixels · ${(file.size / 1024).toFixed(0)} KB`;
    processButton.disabled = false;
    setStatus('Image ready. Choose your settings, then process with OpenCV.');
  } catch (error) {
    URL.revokeObjectURL(candidateUrl);

    if (version === selectionVersion) {
      setStatus(error.message || 'This image could not be displayed.', true);
    }
  }
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result.split(',')[1]);
    };

    reader.onerror = () => {
      reject(new Error('The selected file could not be read.'));
    };

    reader.readAsDataURL(file);
  });
}

function addMetric(label, value) {
  const group = document.createElement('div');
  const term = document.createElement('dt');
  const definition = document.createElement('dd');
  term.textContent = label;
  definition.textContent = value;
  group.append(term, definition);
  document.querySelector('#metrics').append(group);
}

function displayResults(report) {
  resetResults();
  currentReport = report;
  const metrics = report.metrics;

  addMetric('Source dimensions', `${metrics.sourceWidth} × ${metrics.sourceHeight}`);
  addMetric('Processing dimensions', `${metrics.processedWidth} × ${metrics.processedHeight}`);
  addMetric('Foreground coverage', `${metrics.foregroundPercent}%`);
  addMetric('Brightness · 0–255', metrics.brightness);
  addMetric('Contrast · intensity SD', metrics.contrast);
  addMetric('Focus · Laplacian variance', metrics.focusScore);
  addMetric('Connected regions', metrics.retainedComponents);
  addMetric('Removed specks', metrics.removedComponents);
  addMetric('Boundary contours', metrics.contours);

  for (const note of report.reviewNotes) {
    const item = document.createElement('li');
    item.textContent = note;
    document.querySelector('#review-notes').append(item);
  }

  for (const stage of report.stages) {
    const card = document.createElement('article');
    card.className = 'stage-card';

    const heading = document.createElement('h3');
    heading.textContent = stage.title;

    const description = document.createElement('p');
    description.textContent = stage.description;

    const previewButton = document.createElement('button');
    previewButton.className = 'stage-preview';
    previewButton.type = 'button';
    previewButton.setAttribute('aria-label', `Enlarge ${stage.title}`);

    const image = document.createElement('img');
    image.src = stage.image;
    image.alt = stage.title;
    image.loading = 'lazy';
    previewButton.append(image);

    previewButton.addEventListener('click', () => {
      document.querySelector('#image-dialog-title').textContent = stage.title;
      const enlarged = document.querySelector('#enlarged-image');
      enlarged.src = stage.image;
      enlarged.alt = stage.title;
      imageDialog.showModal();
    });

    const download = document.createElement('a');
    download.href = stage.image;
    download.download = `spirascan-${stage.id}.png`;
    download.textContent = 'Download PNG ↓';

    card.append(heading, description, previewButton, download);
    document.querySelector('#stages').append(card);
  }

  results.hidden = false;
  document.querySelector('#source-preview').hidden = true;
  reportButton.disabled = false;
}

fileInput.addEventListener('change', () => {
  selectImage(fileInput.files[0]);
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();

  if (!isBusy) {
    dropZone.classList.add('dragging');
  }
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragging');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');

  if (event.dataTransfer.files.length !== 1) {
    setStatus('Please select one image at a time.', true);
    return;
  }

  selectImage(event.dataTransfer.files[0]);
});

document.querySelector('#sample-button').addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#173453';
  context.lineWidth = 4;
  context.beginPath();

  for (let step = 0; step <= 900; step += 1) {
    const angle = step * 0.027;
    const radius = 8 + step * 0.35;
    const x = 400 + Math.cos(angle) * radius;
    const y = 400 + Math.sin(angle) * radius;

    if (step === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();
  canvas.toBlob((blob) => {
    selectImage(new File([blob], 'sample-spiral.png', { type: 'image/png' }));
  }, 'image/png');
});

document.querySelector('#processing-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedFile || isBusy) {
    return;
  }

  resetResults();
  setBusy(true);
  setStatus('OpenCV is preparing your image. This may take a few seconds.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const image = await readAsBase64(selectedFile);
    const options = {
      rotation: Number(document.querySelector('#rotation').value),
      threshold: document.querySelector('#threshold').value,
      blur: Number(document.querySelector('#blur').value),
      minimumComponent: Number(document.querySelector('#specks').value)
    };

    const response = await fetch('/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image, options }),
      signal: controller.signal
    });

    const report = await response.json();

    if (!response.ok) {
      throw new Error(report.error || 'Image processing failed.');
    }

    displayResults(report);
    const completionMessage =
      `Ready: ${report.stages.length} stages produced with OpenCV ${report.opencvVersion}. ` +
      'Click an image to enlarge it.';
    setStatus(completionMessage);
  } catch (error) {
    document.querySelector('#source-preview').hidden = false;
    const text = error.name === 'AbortError'
      ? 'Processing timed out. Try a smaller image.'
      : error.message;
    setStatus(`${text} Make sure the project is running with npm start or F5.`, true);
  } finally {
    clearTimeout(timeout);
    setBusy(false);
  }
});

document.querySelector('#settings').addEventListener('change', () => {
  if (currentReport) {
    resetResults();
    document.querySelector('#source-preview').hidden = false;
    setStatus('Settings changed. Process again to see updated results.');
  }
});

reportButton.addEventListener('click', () => {
  if (!currentReport) {
    return;
  }

  // Keep the report small: images are downloaded separately from the stage cards.
  const report = {
    application: 'SpiraScan',
    generatedAt: new Date().toISOString(),
    fileName: selectedFile.name,
    metrics: currentReport.metrics,
    settings: currentReport.settings,
    reviewNotes: currentReport.reviewNotes,
    opencvVersion: currentReport.opencvVersion,
    notice: currentReport.notice
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'spirascan-image-review.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.querySelector('#clear-button').addEventListener('click', clearImage);
document.querySelector('#close-image-dialog').addEventListener('click', () => {
  imageDialog.close();
});

window.addEventListener('beforeunload', () => {
  if (sourceUrl) {
    URL.revokeObjectURL(sourceUrl);
  }
});
