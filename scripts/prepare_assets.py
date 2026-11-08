#!/usr/bin/env python3
"""Import the existing Kidsbox artwork/audio and compile the Tiled room for Phaser.

This is an optional source-asset maintenance command, not part of npm build.
The generated public/assets folder is sufficient to run the standalone web game.
"""
from pathlib import Path
import json
import os
import shutil
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("KIDSBOX_SOURCE", "/Users/wyj/kidsbox")).expanduser().resolve()
OUT = ROOT / "public" / "assets"
TILED = SOURCE / "assets" / "restaurant_v2" / "tiled"

RESIDENTS = ["aya", "eli", "grandpa", "leo", "lina", "mei", "mira", "noah", "rosa", "sam"]
INGREDIENTS = ["tomato", "egg", "noodles", "bread", "cheese", "apple", "banana", "grapes"]
DISHES = ["tomato_egg_noodles_food", "pizza_food", "fruit_salad_food"]
PREPARED = ["tomato_chunks", "tomato_slices", "cheese_shreds"]
REACTIONS = ["delicious", "happy_tummy", "best_meal", "thank_you", "every_bite", "super_yummy", "again", "more_please"]


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def webp(source: Path, destination: Path, max_size: int | None = None) -> None:
    ensure_parent(destination)
    with Image.open(source) as image:
        if max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        image.save(destination, "WEBP", quality=88, method=6)


def copy(source: Path, destination: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(source)
    ensure_parent(destination)
    shutil.copy2(source, destination)


def compile_room() -> None:
    map_root = ET.parse(TILED / "room.tmx").getroot()
    tileset_root = ET.parse(TILED / "tiles.tsx").getroot()
    tile_images = {
        int(tile.attrib["id"]) + 1: tile.find("image").attrib["source"]
        for tile in tileset_root.findall("tile")
    }
    width = int(map_root.attrib["width"])
    height = int(map_root.attrib["height"])
    tile_size = int(map_root.attrib["tilewidth"])
    base = Image.new("RGBA", (width * tile_size, height * tile_size), "#f3dfc0")
    for layer in map_root.findall("layer"):
        data = layer.find("data").text.strip().replace("\n", "").split(",")
        for index, raw_gid in enumerate(data):
            gid = int(raw_gid)
            if gid == 0:
                continue
            with Image.open(TILED / "images" / tile_images[gid]) as tile:
                base.alpha_composite(tile.convert("RGBA"), ((index % width) * tile_size, (index // width) * tile_size))
    ensure_parent(OUT / "room" / "room-base.webp")
    base.convert("RGB").save(OUT / "room" / "room-base.webp", "WEBP", quality=91, method=6)

    groups = {}
    sprites = set()
    for group in map_root.findall("objectgroup"):
        name = group.attrib["name"]
        rows = []
        for obj in group.findall("object"):
            properties = {
                prop.attrib["name"]: prop.attrib.get("value", "")
                for prop in obj.find("properties") or []
            }
            row = {
                "name": obj.attrib.get("name", ""),
                "x": float(obj.attrib.get("x", 0)),
                "y": float(obj.attrib.get("y", 0)),
                "width": float(obj.attrib.get("width", 0)),
                "height": float(obj.attrib.get("height", 0)),
            }
            if "sprite" in properties:
                row["sprite"] = Path(properties["sprite"]).stem + ".webp"
                row["depth"] = float(properties.get("depth", row["y"] + row["height"]))
                sprites.add(properties["sprite"])
            rows.append(row)
        groups[name] = rows
    for sprite in sprites | {"fridge_open.png", "knife_rack.png", "knife_flying.png", "cooking_flame.png"}:
        webp(TILED / "images" / sprite, OUT / "room" / (Path(sprite).stem + ".webp"), 1600)
    (OUT / "room" / "layout.json").write_text(json.dumps(groups, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    compile_room()
    for ingredient in INGREDIENTS:
        webp(SOURCE / "assets" / "cooking" / "ingredients" / f"{ingredient}.png", OUT / "ingredients" / f"{ingredient}.webp", 512)
    for dish in DISHES:
        webp(SOURCE / "assets" / "cooking" / "dishes" / f"{dish}.png", OUT / "dishes" / f"{dish}.webp", 640)
    for prepared in PREPARED:
        webp(SOURCE / "assets" / "cooking" / "prepared" / f"{prepared}.png", OUT / "prepared" / f"{prepared}.webp", 512)
    webp(SOURCE / "assets" / "cooking" / "stove" / "mixing_bowl_top.png", OUT / "room" / "mixing_bowl.webp", 512)
    with Image.open(TILED / "images" / "kitchen_workstation_clean.png") as workstation:
        workstation.crop((530, 125, 715, 205)).save(OUT / "room" / "pot_front.webp", "WEBP", quality=92, method=6)
    webp(SOURCE / "assets" / "restaurant_v2" / "chef_girl.png", OUT / "people" / "chef.webp", 512)
    webp(SOURCE / "assets" / "restaurant_v2" / "guest_rabbit.png", OUT / "people" / "rabbit.webp", 512)
    for resident in RESIDENTS:
        copy(SOURCE / "assets" / "branding" / "town_people" / f"{resident}.webp", OUT / "people" / f"{resident}.webp")
    webp(SOURCE / "assets" / "branding" / "restaurant_preview_icon.png", OUT / "ui" / "restaurant-icon.webp", 512)

    generic_audio = INGREDIENTS + ["wrong", "guided_chop", "guided_cook", "guided_bake", "guided_serve", "guided_good", "order", "order_pizza", "order_fruit_salad"]
    for name in generic_audio:
        copy(SOURCE / "assets" / "cooking" / "audio" / f"{name}.mp3", OUT / "audio" / f"{name}.mp3")
    for effect in ["guest_enter", "serve", "payment", "food_pick", "coin"]:
        copy(SOURCE / "assets" / "sounds" / f"{effect}.wav", OUT / "audio" / f"{effect}.wav")
    copy(SOURCE / "assets" / "restaurant_v2" / "audio" / "kitchen_loop.mp3", OUT / "audio" / "kitchen_loop.mp3")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(OUT / "audio" / "kitchen_loop.mp3"), "-filter:a", "atempo=0.65", "-c:a", "libmp3lame", "-q:a", "4", str(OUT / "audio" / "kitchen_loop_slow.mp3")], check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(OUT / "audio" / "kitchen_loop.mp3"), "-filter:a", "atempo=0.5", "-c:a", "libmp3lame", "-q:a", "4", str(OUT / "audio" / "kitchen_loop_calm.mp3")], check=True)

    for resident in RESIDENTS:
        for name in ["order_pizza", "order_tomato_egg_noodles"]:
            copy(SOURCE / "assets" / "cooking" / "audio" / "people" / resident / f"{name}.mp3", OUT / "audio" / "people" / resident / f"{name}.mp3")
        for reaction in REACTIONS:
            copy(SOURCE / "assets" / "sounds" / "reactions" / "people" / resident / f"{reaction}.mp3", OUT / "audio" / "reactions" / "people" / resident / f"{reaction}.mp3")
    for gender in ["female", "male"]:
        for reaction in REACTIONS:
            copy(SOURCE / "assets" / "sounds" / "reactions" / gender / f"{reaction}.mp3", OUT / "audio" / "reactions" / gender / f"{reaction}.mp3")
    print(f"Prepared standalone restaurant assets in {OUT}")


if __name__ == "__main__":
    main()
