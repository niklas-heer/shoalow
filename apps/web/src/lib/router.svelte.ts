/** Minimal path router for home, tables, the tutorial and the card gallery. */
class Router {
  path = $state(location.pathname);

  constructor() {
    addEventListener("popstate", () => {
      this.path = location.pathname;
    });
  }

  go(path: string): void {
    if (path === this.path) return;
    history.pushState(null, "", path);
    this.path = path;
  }

  get learning(): boolean {
    return /^\/learn\/?$/.test(this.path);
  }

  get cards(): boolean {
    return /^\/cards\/?$/.test(this.path);
  }

  get roomCode(): string | null {
    const m = this.path.match(/^\/r\/([A-Za-z0-9]{5})\/?$/);
    return m?.[1]?.toUpperCase() ?? null;
  }
}

export const router = new Router();
