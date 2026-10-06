/** Browser bundle: window.AIPGrid for hosts and runtime screens; mounts the workspace when the page asks for it. */
import { httpGridApi } from "./ui/api.ts";
import { SustantixGrid } from "./ui/grid.ts";
import { mountScreenGrids, SCREEN_GRIDS } from "./ui/screen.ts";
import { LiveFeed } from "./ui/live.ts";
import { mountWorkspace } from "./ui/workspace.ts";

const AIPGrid = { SustantixGrid, httpGridApi, mountWorkspace, mountScreenGrids, SCREEN_GRIDS, LiveFeed };
(globalThis as { AIPGrid?: typeof AIPGrid }).AIPGrid = AIPGrid;

const root = document.getElementById("sxg-workspace");
if (root) void mountWorkspace(root, { api: httpGridApi(root.dataset.api ?? "/api/aip") });
