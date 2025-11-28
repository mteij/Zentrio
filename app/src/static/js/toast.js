function createToast(id, type, title, message, error) {
  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `toast-notification ${type}`;

  const header = document.createElement('div');
  header.className = 'toast-header';

  const titleEl = document.createElement('h4');
  titleEl.className = 'toast-title';
  
  // Add icon based on type
  const iconSpan = document.createElement('span');
  iconSpan.className = 'iconify';
  iconSpan.setAttribute('data-width', '18');
  iconSpan.setAttribute('data-height', '18');
  
  if (type.includes('message') || type === 'success') {
    iconSpan.setAttribute('data-icon', 'lucide:check-circle');
  } else if (type.includes('warning')) {
    iconSpan.setAttribute('data-icon', 'lucide:alert-triangle');
  } else if (type.includes('error')) {
    iconSpan.setAttribute('data-icon', 'lucide:alert-circle');
  }
  
  if (iconSpan.hasAttribute('data-icon')) {
    titleEl.appendChild(iconSpan);
  }
  
  const textNode = document.createTextNode(title);
  titleEl.appendChild(textNode);

  const closeButton = document.createElement('button');
  closeButton.className = 'close-button';
  closeButton.innerHTML = '&times;';
  closeButton.onclick = () => {
    toast.remove();
  };

  header.appendChild(titleEl);
  header.appendChild(closeButton);
  toast.appendChild(header);

  if (message) {
    const messageEl = document.createElement('p');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;
    toast.appendChild(messageEl);
  }

  if (error) {
    const details = document.createElement('details');
    details.className = 'toast-error-details';

    const summary = document.createElement('summary');
    summary.className = 'toast-error-summary';

    const summaryText = document.createElement('span');
    summaryText.className = 'summary-text';
    summaryText.textContent = 'Error Details';

    summary.appendChild(summaryText);
    details.appendChild(summary);

    const pre = document.createElement('pre');
    pre.className = 'toast-error-pre';

    const code = document.createElement('code');
    code.textContent = error;

    pre.appendChild(code);
    details.appendChild(pre);
    toast.appendChild(details);
  }

  return toast;
}

function addToast(type, title, message, error) {
  const id = `toast-${Date.now()}`;
  const toast = createToast(id, type, title, message, error);

  const container = document.getElementById('toast-container');
  if (container) {
    container.appendChild(toast);
  } else {
    const newContainer = document.createElement('div');
    newContainer.id = 'toast-container';
    newContainer.className = 'toast-container';
    document.body.appendChild(newContainer);
    newContainer.appendChild(toast);
  }

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

window.addToast = addToast;