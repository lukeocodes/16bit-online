import { Application, Container } from "pixi.js";

/**
 * PixiJS Application wrapper — replaces Babylon.js SceneManager.
 * Creates the WebGL renderer, manages the sorted world container,
 * and handles resize/disposal.
 */
export class PixiApp {
  public app: Application;
  public worldContainer: Container;

  private resizeHandler: () => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.app = new Application();
    this.worldContainer = new Container();
    this.worldContainer.sortableChildren = true;
    this.resizeHandler = () => this.resize();
  }

  async init(): Promise<void> {
    await this.app.init({
      canvas: this.canvas,
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
      backgroundColor: 0x1a3a5c,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      // We drive rendering from our own Loop.ts — disable the built-in ticker
      autoStart: false,
    });

    this.app.stage.addChild(this.worldContainer);
    window.addEventListener("resize", this.resizeHandler);
    this.resize();
  }

  /** Call from Loop.ts onRender callback */
  render(): void {
    this.app.render();
  }

  get screenWidth(): number {
    return this.app.screen.width;
  }

  get screenHeight(): number {
    return this.app.screen.height;
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.app.renderer.resize(w, h);
  }

  dispose(): void {
    window.removeEventListener("resize", this.resizeHandler);
    this.app.destroy(true);
  }
}
