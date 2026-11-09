const revision = document.currentScript.dataset.revision;
async function check() {
  try {
    const response = await fetch('/__dev/revision', { cache: 'no-store' });
    if (response.ok && await response.text() !== revision) {
      location.reload();
      return;
    }
  } catch {
    // The containers may be starting again.
  }
  setTimeout(check, 800);
}
check();
