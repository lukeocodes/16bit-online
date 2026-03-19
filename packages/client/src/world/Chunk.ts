import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { CHUNK_SIZE, TILE_SIZE } from "./WorldConstants";
import { getTileType } from "./TileRegistry";

/** World units per elevation level (matches server ELEVATION_STEP_HEIGHT) */
const ELEVATION_STEP_HEIGHT = 1.5;

export interface NeighborElevations {
  north: number;
  south: number;
  east: number;
  west: number;
}

export class Chunk {
  public readonly chunkX: number;
  public readonly chunkY: number;
  public readonly chunkZ: number;
  public readonly mapId: number;
  public readonly elevationLevel: number; // 0-6, discrete height band

  private tiles: Uint8Array;
  private mesh: Mesh | null = null;
  private neighborElevations: NeighborElevations;

  constructor(
    mapId: number,
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    tileData?: Uint8Array,
    elevationLevel: number = 0,
    neighborElevations?: NeighborElevations,
  ) {
    this.mapId = mapId;
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.elevationLevel = elevationLevel;
    this.neighborElevations = neighborElevations ?? {
      north: elevationLevel,
      south: elevationLevel,
      east: elevationLevel,
      west: elevationLevel,
    };
    this.tiles = tileData || new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(1);
  }

  get key(): string { return `${this.mapId}:${this.chunkX}:${this.chunkY}:${this.chunkZ}`; }

  getTile(localX: number, localZ: number): number { return this.tiles[localZ * CHUNK_SIZE + localX]; }
  setTileData(data: Uint8Array) { this.tiles = data; }

  buildMesh(scene: Scene): Mesh {
    if (this.mesh) return this.mesh;

    const worldX = this.chunkX * CHUNK_SIZE * TILE_SIZE;
    const worldZ = this.chunkY * CHUNK_SIZE * TILE_SIZE;
    const tileY = this.elevationLevel * ELEVATION_STEP_HEIGHT;
    const tileGroups = new Map<number, Array<{ x: number; z: number }>>();

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tileId = this.tiles[lz * CHUNK_SIZE + lx];
        if (!tileGroups.has(tileId)) tileGroups.set(tileId, []);
        tileGroups.get(tileId)!.push({ x: lx, z: lz });
      }
    }

    const meshes: Mesh[] = [];
    for (const [tileId, positions] of tileGroups) {
      const tileType = getTileType(tileId);
      for (const pos of positions) {
        const tile = MeshBuilder.CreateGround(`tile_${this.key}_${pos.x}_${pos.z}`, { width: TILE_SIZE, height: TILE_SIZE }, scene);
        tile.position.x = worldX + pos.x * TILE_SIZE + TILE_SIZE / 2;
        tile.position.z = worldZ + pos.z * TILE_SIZE + TILE_SIZE / 2;
        tile.position.y = tileY;
        const mat = new StandardMaterial(`tileMat_${tileId}_${this.key}`, scene);
        mat.diffuseColor = tileType.color;
        mat.specularColor = Color3.Black();
        tile.material = mat;
        meshes.push(tile);
      }
    }

    // Generate cliff faces at chunk edges where this chunk is higher than its neighbor
    const cliffColor = new Color3(0.35, 0.33, 0.30);
    const edgeLength = CHUNK_SIZE * TILE_SIZE;

    const edgeConfigs = [
      { neighborLevel: this.neighborElevations.north, dir: "north",
        cx: worldX + edgeLength / 2, cz: worldZ, ry: 0 },
      { neighborLevel: this.neighborElevations.south, dir: "south",
        cx: worldX + edgeLength / 2, cz: worldZ + edgeLength, ry: Math.PI },
      { neighborLevel: this.neighborElevations.east, dir: "east",
        cx: worldX + edgeLength, cz: worldZ + edgeLength / 2, ry: Math.PI / 2 },
      { neighborLevel: this.neighborElevations.west, dir: "west",
        cx: worldX, cz: worldZ + edgeLength / 2, ry: -Math.PI / 2 },
    ];

    for (const edge of edgeConfigs) {
      if (this.elevationLevel <= edge.neighborLevel) continue;

      const cliffHeight = (this.elevationLevel - edge.neighborLevel) * ELEVATION_STEP_HEIGHT;
      const cliffY = tileY - cliffHeight / 2;

      const cliff = MeshBuilder.CreatePlane(`cliff_${edge.dir}_${this.key}`, {
        width: edgeLength,
        height: cliffHeight,
      }, scene);

      cliff.position.x = edge.cx;
      cliff.position.z = edge.cz;
      cliff.position.y = cliffY;
      cliff.rotation.y = edge.ry;

      const mat = new StandardMaterial(`cliffMat_${this.key}_${edge.dir}`, scene);
      mat.diffuseColor = cliffColor;
      mat.specularColor = Color3.Black();
      mat.backFaceCulling = false;
      cliff.material = mat;

      meshes.push(cliff);
    }

    if (meshes.length > 0) {
      this.mesh = Mesh.MergeMeshes(meshes, true, true, undefined, false, true) as Mesh;
      if (this.mesh) this.mesh.name = `chunk_${this.key}`;
    }

    return this.mesh!;
  }

  dispose() { if (this.mesh) { this.mesh.dispose(); this.mesh = null; } }
}
