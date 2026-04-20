import { Engine, DisplayMode, Color } from "excalibur";
import { NetworkManager } from "../net/NetworkManager.js";
import { BuilderScene } from "./BuilderScene.js";
import { TilesetIndex } from "./TilesetIndex.js";

const API = "";

function setLoading(pct: number, text: string): void {
  const bar   = document.getElementById("loading-bar");
  const label = document.getElementById("loading-text");
  if (bar)   bar.style.width = `${pct}%`;
  if (label) label.textContent = text;
}

async function devLogin(): Promise<{ token: string; characterId: string }> {
  setLoading(10, "Logging in…");
  const res = await fetch(`${API}/api/auth/dev-login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ username: "lukeocodes", password: "password" }),
  });
  if (!res.ok) throw new Error("Dev login failed");
  const data = await res.json();
  const token: string = data.gameJwt;
  const chars: Array<{ id: string; name: string }> = data.characters ?? [];
  if (chars.length === 0) throw new Error("No character found — seed the database first");
  return { token, characterId: chars[0].id };
}

/** NetworkManager subclass that flags the /offer request as builder-mode. */
class BuilderNetworkManager extends NetworkManager {
  override async connect(token: string, characterId: string): Promise<void> {
    // The base NetworkManager posts to /api/rtc/offer without a `builder`
    // flag. We need the server to recognise us as a builder session — patch
    // fetch temporarily to inject the field.
    //
    // This is the least invasive way to add the flag without changing the
    // NetworkManager signature used by the main game client.
    const origFetch = window.fetch.bind(window);
    const patched: typeof fetch = async (input, init) => {
      if (typeof input === "string" && input.includes("/api/rtc/offer") && init?.body) {
        try {
          const body = JSON.parse(init.body as string);
          body.builder = true;
          init = { ...init, body: JSON.stringify(body) };
        } catch { /* leave body alone */ }
      }
      return origFetch(input, init);
    };
    window.fetch = patched;
    try {
      await super.connect(token, characterId);
    } finally {
      window.fetch = origFetch;
    }
  }
}

async function main(): Promise<void> {
  try {
    const { token, characterId } = await devLogin();

    setLoading(30, "Connecting…");
    const net = new BuilderNetworkManager();
    await net.connect(token, characterId);

    setLoading(55, "Loading tilesets…");
    const tiles = new TilesetIndex();
    await tiles.load();

    setLoading(85, "Loading canvas…");
    const game = new Engine({
      displayMode:     DisplayMode.FillScreen,
      backgroundColor: Color.fromHex("#1a1a2e"),
      antialiasing:    false,
      pixelArt:        true,
    });
    const scene = new BuilderScene(net, characterId, tiles);
    game.addScene("builder", scene);
    await game.start();
    await game.goToScene("builder");
    (window as any).__builder = { game, net, scene, tiles };

    setLoading(100, "Ready");
    document.getElementById("loading")?.classList.add("hidden");
  } catch (err) {
    const label = document.getElementById("loading-text");
    if (label) label.textContent = `Error: ${(err as Error).message}`;
    console.error(err);
  }
}

main();
