(function () {
  const selector = document.getElementById('version-selector');

  if (!selector) {
    return;
  }

  function normalizePath(pathname) {
    if (!pathname) return '/';
    return pathname.endsWith('/') ? pathname : pathname + '/';
  }

  function setSelectedByUrl(versions) {
    const currentPath = normalizePath(window.location.pathname);

    for (const version of versions) {
      if (!version || !version.url || !version.public) {
        continue;
      }

      let urlPath;
      try {
        urlPath = normalizePath(new URL(version.url, window.location.origin).pathname);
      } catch (_) {
        continue;
      }

      if (urlPath === currentPath) {
        selector.value = version.url;
        return;
      }
    }
  }

  async function loadVersions() {
    try {
      const response = await fetch('./releases/versions.json', { cache: 'no-cache' });
      if (!response.ok) {
        const fallbackOption = document.createElement('option');
        fallbackOption.value = './';
        fallbackOption.textContent = 'Latest';
        selector.appendChild(fallbackOption);
        return;
      }

      const releaseData = await response.json();
      const versions = Array.isArray(releaseData.versions) ? releaseData.versions : [];
      const publicVersions = versions.filter((v) => v && v.public && v.url);

      if (publicVersions.length === 0) {
        const fallbackOption = document.createElement('option');
        fallbackOption.value = './';
        fallbackOption.textContent = 'Latest';
        selector.appendChild(fallbackOption);
      }

      publicVersions.forEach((v) => {
        const option = document.createElement('option');
        option.value = v.url;
        option.textContent = v.status === 'current' ? `${v.name} (latest)` : v.name;
        selector.appendChild(option);
      });

      setSelectedByUrl(publicVersions);

      selector.addEventListener('change', function () {
        const destination = selector.value;
        if (!destination) {
          return;
        }
        window.location.href = destination;
      });
    } catch (error) {
      console.warn('Could not load version list:', error);
    }
  }

  loadVersions();
})();
