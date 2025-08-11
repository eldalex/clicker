from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import List, Tuple, Dict


class TileType(str, Enum):
    EMPTY = "empty"
    WALL = "wall"


@dataclass
class Level:
    width: int
    height: int
    grid: List[List[TileType]]
    cat_start: Tuple[int, int]
    name: str | None = None

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height

    def tile_at(self, x: int, y: int) -> TileType:
        if not self.in_bounds(x, y):
            raise IndexError(f"Coordinates out of bounds: {(x, y)}")
        return self.grid[y][x]

    def is_wall(self, x: int, y: int) -> bool:
        return self.tile_at(x, y) == TileType.WALL

    def is_empty(self, x: int, y: int) -> bool:
        return self.tile_at(x, y) == TileType.EMPTY


def _validate_and_parse(data: Dict) -> Level:
    if not isinstance(data, dict):
        raise ValueError("Level data must be a JSON object")

    size = data.get("size")
    if not isinstance(size, dict) or not {"width", "height"} <= set(size):
        raise ValueError("Level.size must include 'width' and 'height'")
    width = int(size["width"])
    height = int(size["height"])
    if width <= 0 or height <= 0:
        raise ValueError("Level size must be positive")

    legend = data.get("legend", {"#": "wall", ".": "empty"})
    if not isinstance(legend, dict):
        raise ValueError("Level.legend must be an object mapping chars to tile types")

    valid_types = {t.value for t in TileType}
    for ch, kind in legend.items():
        if not isinstance(ch, str) or len(ch) != 1:
            raise ValueError("Legend keys must be single-character strings")
        if kind not in valid_types:
            raise ValueError(f"Unknown tile type in legend: {kind}")

    tiles = data.get("tiles")
    if not isinstance(tiles, list) or len(tiles) != height:
        raise ValueError("Level.tiles must be a list of strings with length == height")

    grid: List[List[TileType]] = []
    for row in tiles:
        if not isinstance(row, str) or len(row) != width:
            raise ValueError("Each tiles row must be a string of length == width")
        parsed_row: List[TileType] = []
        for ch in row:
            mapped = legend.get(ch)
            if mapped is None:
                raise ValueError(f"Character '{ch}' not found in legend")
            parsed_row.append(TileType(mapped))
        grid.append(parsed_row)

    start = data.get("cat_start")
    if (
        not isinstance(start, (list, tuple))
        or len(start) != 2
        or not all(isinstance(v, int) for v in start)
    ):
        raise ValueError("cat_start must be [x, y] with integer coordinates")
    sx, sy = int(start[0]), int(start[1])
    if not (0 <= sx < width and 0 <= sy < height):
        raise ValueError("cat_start is out of bounds")
    if grid[sy][sx] == TileType.WALL:
        raise ValueError("cat_start cannot be on a wall tile")

    return Level(
        width=width,
        height=height,
        grid=grid,
        cat_start=(sx, sy),
        name=data.get("name"),
    )


def load_level(path: str | Path) -> Level:
    p = Path(path)
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return _validate_and_parse(data)


def load_level_from_str(s: str) -> Level:
    data = json.loads(s)
    return _validate_and_parse(data)


def level_to_dict(level: Level, legend: Dict[str, str] | None = None) -> Dict:
    # Default legend mirrors the loader default
    legend = legend or {"#": "wall", ".": "empty"}
    rev: Dict[TileType, str] = {}
    for ch, kind in legend.items():
        rev[TileType(kind)] = ch

    tiles: List[str] = []
    for y in range(level.height):
        row_chars: List[str] = []
        for x in range(level.width):
            tile = level.grid[y][x]
            ch = rev.get(tile)
            if ch is None:
                # Fallback: empty if unmapped
                ch = "."
            row_chars.append(ch)
        tiles.append("".join(row_chars))

    return {
        "name": level.name,
        "size": {"width": level.width, "height": level.height},
        "legend": legend,
        "tiles": tiles,
        "cat_start": [level.cat_start[0], level.cat_start[1]],
    }

