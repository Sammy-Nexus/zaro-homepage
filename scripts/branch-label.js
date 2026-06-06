(function () {
  const branch = document.documentElement.dataset.branch;
  if (!branch) return;

  const port = location.port;
  const tag = port ? `${branch}:${port}` : branch;

  if (!document.title.startsWith(`[${tag}]`)) {
    document.title = `[${tag}] ${document.title}`;
  }

  const url = new URL(location.href);
  if (url.searchParams.get("branch") !== branch) {
    url.searchParams.set("branch", branch);
    history.replaceState(null, "", url);
  }
})();
