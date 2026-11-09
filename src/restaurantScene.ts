import Phaser from 'phaser';
import { AudioManager } from './audio';
import {
  CHEF_ANCHORS, GUEST_SEATS, INGREDIENTS, RECIPES, RESIDENTS, REACTIONS, SERVE_ANCHORS,
  STATION_HIT_AREAS, STATION_META, TABLE_ANCHORS, WORLD_HEIGHT, WORLD_WIDTH, preparationFor,
  type IngredientId, type PreparationRule, type Recipe, type Resident, type StationId, type VesselId, type WordId,
} from './data';
import { OrderProgress } from './logic';
import { findPath, type Rect } from './pathfinding';
import type { RestaurantStore } from './store';
import type { GameUI, OrderView } from './ui';

interface Furniture { name: string; x: number; y: number; width: number; height: number; sprite: string; depth: number }
interface RoomLayout { furniture: Furniture[] }
interface Actor { view: Phaser.GameObjects.Container; image: Phaser.GameObjects.Image }
interface IngredientVisual { id: IngredientId; rule: PreparationRule; sprites: Phaser.GameObjects.Image[] }
type GuestPhase = 'arriving' | 'ordering' | 'seating' | 'waiting' | 'eating' | 'paying' | 'leaving';
interface Guest {
  id: number;
  recipe: Recipe;
  resident: Resident;
  tableIndex: number;
  phase: GuestPhase;
  actor: Actor;
  paymentRef?: string;
  dish?: Phaser.GameObjects.Image;
  prompt?: Phaser.GameObjects.Container;
  hitZone?: Phaser.GameObjects.Zone;
}

const ROOM_IMAGES = [
  'baseboard', 'window', 'fridge', 'fridge_open', 'kitchen_workstation_clean', 'counter_full',
  'pos_register', 'table', 'entrance', 'front_fence', 'cutting_board_clean', 'knife_rack_empty',
  'knife_rack', 'knife_flying', 'cooking_flame', 'mixing_bowl', 'pot_front', 'empty-oven',
];
const OBSTACLES: Rect[] = [
  { x: 85, y: 370, width: 1030, height: 135 },
  { x: 145, y: 530, width: 245, height: 140 },
  { x: 810, y: 530, width: 245, height: 140 },
  { x: 80, y: 705, width: 250, height: 155 },
  { x: 875, y: 705, width: 250, height: 155 },
  { x: 460, y: 640, width: 280, height: 175 },
  { x: 135, y: 280, width: 190, height: 45 },
  { x: 340, y: 285, width: 700, height: 40 },
];

export class RestaurantScene extends Phaser.Scene {
  private ready = false;
  private started = false;
  private busy = false;
  private chef!: Actor;
  private fridge?: Phaser.GameObjects.Image;
  private knifeRack?: Phaser.GameObjects.Image;
  private saladBowl?: Phaser.GameObjects.Image;
  private potMask?: Phaser.Display.Masks.GeometryMask;
  private bowlMask?: Phaser.Display.Masks.GeometryMask;
  private guests: (Guest | undefined)[] = [undefined, undefined, undefined, undefined];
  private orderingGuest?: Guest;
  private active?: { guest: Guest; progress: OrderProgress };
  private nextGuestTimer?: Phaser.Time.TimerEvent;
  private guestCounter = 0;
  private recipeDeck: Recipe[] = [];
  private held?: Phaser.GameObjects.Image;
  private ingredientVisuals: IngredientVisual[] = [];
  private preparedDish?: Phaser.GameObjects.Image;
  private targetRing?: Phaser.GameObjects.Ellipse;
  private targetHand?: Phaser.GameObjects.Text;
  private targetHandBaseY = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly ui: GameUI, private readonly audio: AudioManager, private readonly store: RestaurantStore) {
    super('restaurant');
  }

  preload(): void {
    this.load.on('progress', (value: number) => this.ui.loading(value));
    this.load.image('room-base', '/assets/room/room-base.webp');
    this.load.json('room-layout', '/assets/room/layout.json');
    for (const name of ROOM_IMAGES) this.load.image(`room-${name}`, `/assets/room/${name}.webp`);
    this.load.image('counter-register', '/assets/counter/register-back.webp');
    this.load.image('counter-flower', '/assets/counter/flower-vase.webp');
    this.load.image('counter-menu', '/assets/counter/menu-stand.webp');
    this.load.image('counter-napkins', '/assets/counter/napkin-holder.webp');
    this.load.image('chef', '/assets/people/chef.webp');
    this.load.image('rabbit', '/assets/people/rabbit.webp');
    for (const resident of RESIDENTS) this.load.image(`resident-${resident.id}`, resident.image);
    for (const ingredient of Object.values(INGREDIENTS)) this.load.image(`ingredient-${ingredient.id}`, ingredient.image);
    for (const recipe of RECIPES) {
      this.load.image(`dish-${recipe.id}`, recipe.dishImage);
      for (const ingredient of recipe.ingredients) {
        const rule = preparationFor(recipe, ingredient.id);
        if (rule.preparedImage) this.load.image(`prepared-${recipe.id}-${ingredient.id}`, rule.preparedImage);
      }
    }
  }

  create(): void {
    this.add.image(0, 0, 'room-base').setOrigin(0).setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setDepth(-1000);
    const layout = this.cache.json.get('room-layout') as RoomLayout;
    for (const furniture of layout.furniture) {
      const key = `room-${furniture.sprite.replace('.webp', '')}`;
      const depth = furniture.name === 'entrance' ? 620 : furniture.depth;
      const image = this.add.image(furniture.x, furniture.y, key).setOrigin(0).setDisplaySize(furniture.width, furniture.height).setDepth(depth);
      if (furniture.name === 'fridge') this.fridge = image;
      if (furniture.name === 'pos_register') {
        // setTexture replaces the source dimensions; apply our counter size afterwards.
        image.setTexture('counter-register').setDisplaySize(90, 75).setPosition(960, 320);
      }
      if (furniture.name === 'knife_rack') {
        this.knifeRack = image;
        image.setTexture('room-knife_rack');
      }
    }
    // Hide the baked pizza painted into the source workstation. The oven starts empty with a steel tray.
    this.add.image(835, 137, 'room-empty-oven').setOrigin(0).setDisplaySize(130, 46).setDepth(322);
    const counterDecor = [
      { key: 'counter-flower', x: 120, y: 316, width: 64, height: 84 },
      { key: 'counter-napkins', x: 675, y: 344, width: 66, height: 55 },
      { key: 'counter-menu', x: 790, y: 335, width: 54, height: 62 },
    ];
    for (const item of counterDecor) {
      this.add.image(item.x, item.y, item.key).setOrigin(0).setDisplaySize(item.width, item.height).setDepth(510);
    }
    this.chef = this.createActor('chef', 600, 345, 150, 210);
    this.saladBowl = this.add.image(535, 170, 'room-mixing_bowl').setDisplaySize(110, 110).setDepth(328).setVisible(false);
    this.add.image(605, 132.5, 'room-pot_front').setOrigin(0).setDisplaySize(92.5, 40).setDepth(336);
    this.potMask = this.make.graphics().fillStyle(0xffffff).fillEllipse(650, 130, 72, 26).createGeometryMask();
    this.bowlMask = this.make.graphics().fillStyle(0xffffff).fillEllipse(535, 155, 76, 34).createGeometryMask();
    this.createInteractions();
    this.targetRing = this.add.ellipse(0, 0, 160, 90, 0xffd45e, 0.08).setStrokeStyle(4, 0xf2b84b, 0.72).setDepth(1600).setVisible(false);
    this.targetHand = this.add.text(0, 0, '☝', { fontFamily: 'Arial, sans-serif', fontSize: '30px' }).setOrigin(0.5).setDepth(1601).setVisible(false);
    this.ready = true;
    this.ui.ready();
  }

  private createActor(texture: string, x: number, y: number, width: number, height: number): Actor {
    const shadow = this.add.ellipse(0, -2, width * 0.65, 18, 0x493522, 0.15);
    const image = this.add.image(0, 0, texture).setOrigin(0.5, 1).setDisplaySize(width, height);
    const view = this.add.container(x, y, [shadow, image]).setDepth(y);
    return { view, image };
  }

  private createInteractions(): void {
    for (const station of Object.keys(STATION_HIT_AREAS) as StationId[]) {
      const area = STATION_HIT_AREAS[station];
      const zone = this.add.zone(area.x + area.width / 2, area.y + area.height / 2, area.width, area.height).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { void this.handleStation(station); });
    }
    TABLE_ANCHORS.forEach((point, tableIndex) => {
      const zone = this.add.zone(point.x, point.y, 240, 185).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { void this.serveTable(tableIndex); });
      this.add.circle(point.x, point.y + 18, 20, 0xfffaf0, 0.96).setStrokeStyle(2, 0xe85c43, 0.8).setDepth(point.y + 96);
      this.add.text(point.x, point.y + 18, String(tableIndex + 1), {
        fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#bd4132',
      }).setOrigin(0.5).setDepth(point.y + 97);
    });
  }

  startService(): void {
    if (!this.ready || this.started) return;
    this.started = true;
    this.ui.start();
    this.updateHighlight();
    const delay = Math.max(0, Number(new URLSearchParams(window.location.search).get('delay') ?? 500) || 0);
    this.time.delayedCall(delay, () => this.spawnGuest());
  }

  private nextRecipe(): Recipe {
    if (this.recipeDeck.length === 0) {
      const forced = new URLSearchParams(window.location.search).get('recipe');
      const first = RECIPES.find((recipe) => recipe.id === forced);
      const rest = RECIPES.filter((recipe) => recipe.id !== first?.id);
      this.recipeDeck = first ? [first, ...Phaser.Utils.Array.Shuffle(rest)] : Phaser.Utils.Array.Shuffle([...RECIPES]);
    }
    return this.recipeDeck.shift()!;
  }

  private spawnGuest(): void {
    if (!this.started || this.active || this.orderingGuest) return;
    const tableIndex = this.guests.findIndex((guest) => !guest);
    if (tableIndex < 0) { this.scheduleNextGuest(2000); return; }
    if (this.guests.some((guest) => guest?.phase === 'arriving')) return;
    const id = ++this.guestCounter;
    const usedResidents = new Set(this.guests.filter((guest) => guest).map((guest) => guest!.resident.id));
    const availableResidents = RESIDENTS.filter((resident) => !usedResidents.has(resident.id));
    const resident = id === 1 ? RESIDENTS[0] : Phaser.Math.RND.pick(availableResidents.length > 0 ? availableResidents : RESIDENTS);
    const actor = this.createActor(id === 1 ? 'rabbit' : `resident-${resident.id}`, 600, 865, 150, 205);
    actor.view.setAlpha(0);
    const guest: Guest = { id, recipe: this.nextRecipe(), resident, tableIndex, phase: 'arriving', actor };
    this.guests[tableIndex] = guest;
    this.audio.effectSound('guest_enter');
    actor.view.setAlpha(1);
    void this.moveActor(actor, { x: 480, y: 590 }, 380, false).then(() => {
      if (guest.phase !== 'arriving') return;
      guest.phase = 'ordering';
      this.orderingGuest = guest;
      this.waitForOrderInteraction(guest);
    });
  }

  private waitForOrderInteraction(guest: Guest): void {
    this.ui.task({ text: '点击柜台前的客人', english: 'Tap the guest to take the order.', stepNumber: 1, progress: 0 });
    const zone = this.add.zone(480, 490, 180, 220).setDepth(1550).setInteractive({ useHandCursor: true });
    guest.hitZone = zone;
    zone.on('pointerdown', () => this.openOrderInteraction(guest));
    const bubble = this.add.container(guest.actor.view.x, guest.actor.view.y - 245).setDepth(1650);
    const background = this.add.rectangle(0, 0, 142, 44, 0xe85c43, 0.96).setStrokeStyle(2, 0xffffff, 0.8);
    const text = this.add.text(0, 0, '点我点餐', { fontFamily: 'PingFang SC, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    bubble.add([background, text]);
    guest.prompt = bubble;
    if (!this.reducedMotion) this.tweens.add({ targets: bubble, y: '-=7', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.updateHighlight();
  }

  private clearGuestPrompt(guest: Guest): void {
    if (guest.prompt) {
      this.tweens.killTweensOf(guest.prompt);
      guest.prompt.destroy();
      guest.prompt = undefined;
    }
    guest.hitZone?.destroy();
    guest.hitZone = undefined;
  }

  private openOrderInteraction(guest: Guest): void {
    if (this.orderingGuest !== guest || this.busy || this.ui.modalOpen || guest.phase !== 'ordering') return;
    this.clearGuestPrompt(guest);
    this.showOrderFor(guest);
  }

  takeOrder(): void {
    if (this.orderingGuest) this.openOrderInteraction(this.orderingGuest);
  }

  activateStation(station: StationId): void {
    void this.handleStation(station);
  }

  private orderView(guest: Guest): OrderView { return { recipe: guest.recipe, resident: guest.resident, orderNumber: guest.id }; }

  private showOrderFor(guest: Guest): void {
    this.ui.showOrder(this.orderView(guest));
    this.audio.order(guest.recipe, guest.resident);
  }

  confirmOrder(): void {
    const guest = this.orderingGuest;
    if (!guest || this.busy) return;
    this.clearGuestPrompt(guest);
    this.orderingGuest = undefined;
    this.ui.hideOrder();
    guest.phase = 'seating';
    const progress = new OrderProgress(guest.recipe);
    this.active = { guest, progress };
    this.saladBowl?.setVisible(guest.recipe.id === 'fruit_salad');
    this.ui.showTicket(this.orderView(guest), progress);
    this.updateHighlight();
    void this.moveActor(guest.actor, GUEST_SEATS[guest.tableIndex], 420, false).then(() => {
      if (guest.phase === 'seating') guest.phase = 'waiting';
    });
  }

  replayOrder(): void {
    const guest = this.orderingGuest ?? this.active?.guest;
    if (guest) this.audio.order(guest.recipe, guest.resident);
  }

  closeFridge(): void {
    this.ui.closeFridge();
    this.fridge?.setTexture('room-fridge');
  }

  private async handleStation(station: StationId): Promise<void> {
    if (!this.started || this.busy || this.ui.modalOpen) return;
    const active = this.active;
    if (!active) { this.ui.toast('先接下客人的订单，再开始做菜'); return; }
    const step = active.progress.currentStep;
    if (!step || active.progress.dishReady) return;
    if (step.station !== station) {
      this.audio.wrong();
      this.ui.toast(`现在先${active.progress.task().text}`);
      return;
    }
    this.busy = true;
    this.updateHighlight();
    try {
      const arrived = await this.moveActor(this.chef, CHEF_ANCHORS[station], 510, true);
      if (!arrived) return;
      if (station === 'fridge') {
        this.fridge?.setTexture('room-fridge_open');
        this.ui.showFridge(active.guest.recipe, active.progress);
        return;
      }
      const result = active.progress.performStation(station);
      if (!result.ok || !result.word) return;
      this.learnWord(result.word);
      this.audio.word(result.word);
      this.ui.action(STATION_META[station].english, result.duration ?? 1000);
      await this.animateCooking(station, active.guest.recipe, result.duration ?? 1000);
      if (active.progress.dishReady) {
        this.finishDish(active.guest.recipe, station);
        this.ui.toast(`做好了！点 ${active.guest.tableIndex + 1} 号桌，把菜端过去`);
      }
      this.ui.updateProgress(active.progress);
    } finally {
      this.busy = false;
      this.updateHighlight();
    }
  }

  selectIngredient(id: IngredientId): void {
    if (this.busy || !this.ui.fridgeOpen || !this.active) return;
    const active = this.active;
    const result = active.progress.takeIngredient(id);
    if (!result.ok) {
      this.audio.wrong();
      this.ui.wrongIngredient(id);
      this.ui.toast(`还没轮到${INGREDIENTS[id].chinese}，${active.progress.task().english}`);
      return;
    }
    this.busy = true;
    if (result.word) this.learnWord(result.word);
    this.audio.word(id);
    this.audio.effectSound('food_pick');
    this.ui.updateProgress(active.progress);
    this.ui.updateFridge(active.guest.recipe, active.progress);
    this.ui.setFridgeBusy(true);
    void this.flyIngredient(id, result.ingredientCount ?? 1).then(() => {
      if (result.finishedIngredients) this.closeFridge();
      else this.ui.updateFridge(active.guest.recipe, active.progress);
      this.busy = false;
      this.updateHighlight();
    });
  }

  private learnWord(word: WordId): void {
    if (this.store.learnWord(word)) this.ui.toast(`新单词已收集：${word}`);
    this.ui.updateStore();
  }

  private setHeld(texture: string): void {
    this.held?.destroy();
    this.held = this.add.image(this.chef.view.x + 55, this.chef.view.y - 95, texture).setDisplaySize(46, 46).setDepth(this.chef.view.depth + 2);
  }

  private vesselPoint(vessel: VesselId, slot: number): { x: number; y: number } {
    const column = slot % 3;
    const row = Math.floor(slot / 3) % 2;
    if (vessel === 'pot') return { x: 635 + column * 15, y: 128 + row * 5 };
    if (vessel === 'oven') return { x: 875 + column * 25, y: 160 + row * 10 };
    return { x: 510 + column * 25, y: 155 + row * 8 };
  }

  private presentInVessel(sprite: Phaser.GameObjects.Image, vessel: VesselId): void {
    if (vessel === 'pot') {
      sprite.setDisplaySize(26, 26);
      if (this.potMask) sprite.setMask(this.potMask);
    } else if (vessel === 'bowl') {
      sprite.setDisplaySize(28, 28);
      if (this.bowlMask) sprite.setMask(this.bowlMask);
    } else sprite.setDisplaySize(24, 24);
  }

  private async flySpriteTo(sprite: Phaser.GameObjects.Image, destination: { x: number; y: number }, duration = 620, vessel?: VesselId): Promise<void> {
    const start = { x: sprite.x, y: sprite.y };
    const tweenDuration = this.reducedMotion ? Math.min(duration, 120) : duration;
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: sprite, x: destination.x, angle: this.reducedMotion ? 0 : 350, duration: tweenDuration, ease: 'Cubic.Out',
        onUpdate: (tween) => {
          const progress = tween.progress;
          sprite.y = start.y + (destination.y - start.y) * progress - (this.reducedMotion ? 0 : Math.sin(progress * Math.PI) * 105);
        },
        onComplete: () => resolve(),
      });
    });
    sprite.setPosition(destination.x, destination.y).setDepth(334).setAngle(0);
    if (vessel) this.presentInVessel(sprite, vessel);
  }

  private async flyIngredient(id: IngredientId, count: number): Promise<void> {
    if (!this.active) return;
    const rule = preparationFor(this.active.guest.recipe, id);
    const boardSlot = this.ingredientVisuals.filter((visual) => visual.rule.requiresCut).length;
    const vesselSlot = this.ingredientVisuals.filter((visual) => !visual.rule.requiresCut && visual.rule.destination === rule.destination).length;
    const destination = rule.requiresCut ? { x: 420 + boardSlot * 45, y: 140 } : this.vesselPoint(rule.destination, vesselSlot);
    const image = this.add.image(235, 245, `ingredient-${id}`).setDisplaySize(50, 50).setDepth(1700);
    this.ingredientVisuals.push({ id, rule, sprites: [image] });
    await this.flySpriteTo(image, destination, 620, rule.requiresCut ? undefined : rule.destination);
    if (rule.requiresCut) image.setDisplaySize(count > 1 ? 36 : 32, count > 1 ? 36 : 32);
  }

  private clearPreparation(): void {
    for (const visual of this.ingredientVisuals) {
      for (const sprite of visual.sprites) sprite.destroy();
    }
    this.ingredientVisuals = [];
    this.preparedDish?.destroy();
    this.preparedDish = undefined;
    this.held?.destroy();
    this.held = undefined;
    this.saladBowl?.setVisible(false);
  }

  private createChoppedState(visual: IngredientVisual, recipe: Recipe): void {
    const nextSprites: Phaser.GameObjects.Image[] = [];
    for (const sprite of visual.sprites) {
      if (visual.rule.preparedImage) {
        sprite.setTexture(`prepared-${recipe.id}-${visual.id}`).setCrop().setDisplaySize(46, 46).setAngle(-8);
        nextSprites.push(sprite);
        continue;
      }
      const { x, y, depth } = sprite;
      sprite.destroy();
      for (let index = 0; index < 2; index += 1) {
        const piece = this.add.image(x + (index === 0 ? -17 : 17), y, `ingredient-${visual.id}`).setDepth(depth);
        const width = piece.width;
        const height = piece.height;
        piece.setCrop(index * width / 2, 0, width / 2, height).setDisplaySize(24, 34).setAngle(index === 0 ? -22 : 22);
        nextSprites.push(piece);
      }
    }
    visual.sprites = nextSprites;
  }

  private async animateKnifePreparation(recipe: Recipe, duration: number): Promise<void> {
    this.held?.destroy();
    this.held = undefined;
    const cutVisuals = this.ingredientVisuals.filter((visual) => visual.rule.requiresCut);
    this.knifeRack?.setTexture('room-knife_rack_empty');
    const knife = this.add.image(500, 72, 'room-knife_flying').setDisplaySize(16, 100).setAngle(-12).setDepth(1500);
    const perVisualDuration = duration / Math.max(1, cutVisuals.length);

    for (const visual of cutVisuals) {
      const sprite = visual.sprites[0];
      if (!sprite) continue;
      // Keep the long knife's real proportions and bring its tip onto this exact ingredient.
      await new Promise<void>((resolve) => {
        this.tweens.add({ targets: knife, x: sprite.x - 18, y: sprite.y - 65, angle: -12, duration: 120, ease: 'Sine.Out', onComplete: () => resolve() });
      });
      const cycles = Math.max(1, Math.floor((perVisualDuration - 120) / 200));
      await new Promise<void>((resolve) => {
        this.tweens.add({ targets: knife, y: sprite.y - 45, duration: 100, yoyo: true, repeat: cycles * 2 - 1, ease: 'Sine.InOut', onComplete: () => resolve() });
      });
      this.createChoppedState(visual, recipe);
    }
    this.tweens.killTweensOf(knife);
    knife.destroy();
    this.knifeRack?.setTexture('room-knife_rack');
    await this.wait(280);

    const slots: Record<VesselId, number> = { pot: 0, oven: 0, bowl: 0 };
    for (const visual of this.ingredientVisuals.filter((item) => !item.rule.requiresCut)) slots[visual.rule.destination] += visual.sprites.length;
    const flights: Promise<void>[] = [];
    for (const visual of cutVisuals) {
      for (const sprite of visual.sprites) {
        const destination = this.vesselPoint(visual.rule.destination, slots[visual.rule.destination]++);
        flights.push(this.flySpriteTo(sprite, destination, 560, visual.rule.destination));
      }
    }
    await Promise.all(flights);
    this.ui.toast(recipe.id === 'fruit_salad' ? '切好了，水果都进沙拉碗啦！' : recipe.id === 'pizza' ? '切好了，食材都进烤箱啦！' : '番茄切好了，已经放进锅里！');
  }

  private async animateCooking(station: StationId, recipe: Recipe, duration: number): Promise<void> {
    if (station === 'cuttingBoard') {
      await this.animateKnifePreparation(recipe, duration);
      return;
    }
    const sprites = this.ingredientVisuals.flatMap((visual) => visual.sprites);
    if (station === 'stove') {
      const flame = this.add.image(650, 175, 'room-cooking_flame').setDisplaySize(64, 36).setDepth(335);
      const flameScaleX = flame.scaleX;
      const flameScaleY = flame.scaleY;
      this.tweens.add({ targets: flame, scaleX: flameScaleX * 1.12, scaleY: flameScaleY * 0.88, alpha: 0.65, duration: 180, yoyo: true, repeat: -1 });
      const bubbles = [0, 1, 2].map((index) => this.add.ellipse(635 + index * 15, 130, 10, 10, 0xffffff, 0.65).setDepth(336));
      for (const [index, bubble] of bubbles.entries()) this.tweens.add({ targets: bubble, y: 85, alpha: 0, scale: 1.5, duration: 750, delay: index * 180, repeat: -1 });
      for (const sprite of sprites) sprite.setDepth(334);
      await this.wait(duration);
      this.tweens.killTweensOf([flame, ...bubbles]);
      flame.destroy();
      for (const bubble of bubbles) bubble.destroy();
    } else if (station === 'oven') {
      const glow = this.add.ellipse(900, 165, 130, 50, 0xffa63d, 0.22).setDepth(333);
      this.tweens.add({ targets: glow, alpha: 0.55, scale: 1.15, duration: 350, yoyo: true, repeat: -1 });
      for (const sprite of sprites) sprite.setDepth(334);
      await this.wait(duration);
      this.tweens.killTweensOf(glow);
      glow.destroy();
    }
  }

  private finishDish(recipe: Recipe, station: StationId): void {
    this.clearPreparation();
    const point = station === 'stove' ? { x: 725, y: 180 } : station === 'oven' ? { x: 900, y: 160 } : { x: 535, y: 155 };
    const size = recipe.id === 'fruit_salad' ? 60 : recipe.id === 'pizza' ? 58 : 64;
    this.preparedDish = this.add.image(point.x, point.y, `dish-${recipe.id}`).setDisplaySize(size, size).setDepth(335);
    if (recipe.id === 'fruit_salad') this.saladBowl?.setVisible(true);
  }

  async serveTable(tableIndex: number): Promise<void> {
    if (!this.started || this.busy || this.ui.modalOpen) return;
    const active = this.active;
    if (!active || !active.progress.dishReady) return;
    const guest = active.guest;
    if (guest.tableIndex !== tableIndex) {
      this.audio.wrong();
      this.ui.toast(`这份是 ${guest.tableIndex + 1} 号桌客人的菜`);
      return;
    }
    this.busy = true;
    this.updateHighlight();
    this.preparedDish?.destroy();
    this.preparedDish = undefined;
    if (guest.recipe.id === 'fruit_salad') this.saladBowl?.setVisible(false);
    this.setHeld(`dish-${guest.recipe.id}`);
    try {
      const arrived = await this.moveActor(this.chef, SERVE_ANCHORS[tableIndex], 540, true);
      if (!arrived) return;
      this.audio.effectSound('serve');
      this.audio.word('serve');
      this.learnWord('serve');
      this.held?.destroy();
      this.held = undefined;
      const table = TABLE_ANCHORS[tableIndex];
      // The tabletop ellipse sits above the full table image's midpoint (chairs and cloth extend below it).
      guest.dish = this.add.image(table.x, table.y - 38, `dish-${guest.recipe.id}`).setDisplaySize(86, 86).setAngle(0).setDepth(table.y + 95);
      guest.phase = 'eating';
      guest.paymentRef = `meal:${Date.now()}:${guest.id}`;
      this.store.recordMeal(guest.paymentRef, guest.recipe.id, guest.recipe.price);
      this.active = undefined;
      this.ui.hideTicket();
      this.ui.waitingForGuest();
      this.ui.toast('上菜成功！客人开始用餐啦');
      void this.animateEating(guest);
      this.scheduleNextGuest(1800);
    } finally {
      this.busy = false;
      this.updateHighlight();
    }
  }

  private async animateEating(guest: Guest): Promise<void> {
    if (guest.dish) {
      const scaleX = guest.dish.scaleX * 0.3;
      const scaleY = guest.dish.scaleY * 0.3;
      this.tweens.add({ targets: guest.dish, scaleX, scaleY, alpha: 0.4, duration: 3200, ease: 'Sine.InOut' });
    }
    if (!this.reducedMotion) this.tweens.add({ targets: guest.actor.image, y: -8, duration: 260, yoyo: true, repeat: 5 });
    await this.wait(2800 + Math.random() * 1000);
    if (guest.phase !== 'eating') return;
    const reaction = Phaser.Math.RND.pick([...REACTIONS]);
    this.audio.reaction(guest.resident, reaction.id);
    const bubble = this.add.container(guest.actor.view.x, guest.actor.view.y - 245).setDepth(1800);
    const text = this.add.text(0, 0, reaction.text, { fontFamily: 'Arial Rounded MT Bold, Arial', fontSize: '20px', color: '#17324d', align: 'center', wordWrap: { width: 250 } }).setOrigin(0.5);
    const background = this.add.rectangle(0, 0, 280, 78, 0xfffaf0, 0.97).setStrokeStyle(3, 0xe4cda9);
    bubble.add([background, text]);
    bubble.setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 280, ease: 'Back.Out' });
    await this.wait(1700);
    guest.phase = 'paying';
    if (guest.paymentRef && this.store.settleMeal(guest.paymentRef)) {
      this.audio.effectSound('payment');
      this.ui.celebrate(guest.recipe.price);
      this.animateCoins(guest.actor.view.x, guest.actor.view.y - 120);
    }
    bubble.destroy();
    await this.wait(900);
    guest.phase = 'leaving';
    guest.dish?.destroy();
    await this.moveActor(guest.actor, { x: 600, y: 865 }, 430, false);
    guest.actor.view.destroy();
    this.guests[guest.tableIndex] = undefined;
    if (!this.active && !this.orderingGuest) this.scheduleNextGuest(800);
  }

  private animateCoins(x: number, y: number): void {
    if (this.reducedMotion) return;
    for (let index = 0; index < 6; index += 1) {
      const coin = this.add.text(x, y, '●', { fontFamily: 'Arial', fontSize: '32px', color: '#f6c751' }).setOrigin(0.5).setDepth(2000);
      this.tweens.add({ targets: coin, x: 120 + index * 5, y: 48, angle: 360, duration: 700 + index * 80, delay: index * 55, ease: 'Cubic.In', onComplete: () => coin.destroy() });
    }
  }

  private scheduleNextGuest(delay: number): void {
    if (!this.started || this.nextGuestTimer || this.active || this.orderingGuest) return;
    this.nextGuestTimer = this.time.delayedCall(delay, () => {
      this.nextGuestTimer = undefined;
      this.spawnGuest();
    });
  }

  private async moveActor(actor: Actor, target: { x: number; y: number }, speed: number, pathfind: boolean): Promise<boolean> {
    const start = { x: actor.view.x, y: actor.view.y };
    const points = pathfind ? findPath(start, target, OBSTACLES, { width: WORLD_WIDTH, height: WORLD_HEIGHT, bounds: { x: 45, y: 330, width: 1110, height: 525 } }) : [target];
    if (points.length === 0) {
      this.ui.toast('这条路走不通，请试试另一个位置');
      return false;
    }
    for (const point of points) {
      const distance = Phaser.Math.Distance.Between(actor.view.x, actor.view.y, point.x, point.y);
      if (distance < 2) continue;
      actor.image.setFlipX(point.x < actor.view.x);
      await new Promise<void>((resolve) => {
        this.tweens.add({
          targets: actor.view, x: point.x, y: point.y, duration: Math.max(100, distance / speed * 1000), ease: 'Linear',
          onUpdate: () => {
            actor.view.setDepth(actor.view.y);
            actor.image.y = this.reducedMotion ? 0 : -Math.abs(Math.sin(this.time.now / 75)) * 5;
          },
          onComplete: () => { actor.image.y = 0; resolve(); },
        });
      });
    }
    actor.view.setPosition(target.x, target.y).setDepth(target.y);
    return true;
  }

  private updateHighlight(): void {
    if (!this.targetRing || !this.targetHand) return;
    const task = this.active?.progress.task();
    this.ui.updateGameControls({
      canTakeOrder: Boolean(this.orderingGuest) && !this.busy && !this.ui.modalOpen,
      station: this.busy ? undefined : task?.station,
      table: !this.busy && task?.table ? this.active?.guest.tableIndex : undefined,
      busy: this.busy,
    });
    if (!task || this.busy) {
      this.targetRing.setVisible(false);
      this.targetHand.setVisible(false);
      return;
    }
    let x = 0, y = 0, width = 170, height = 90;
    if (task.table && this.active) {
      const point = TABLE_ANCHORS[this.active.guest.tableIndex];
      x = point.x; y = point.y; width = 250; height = 175;
    } else if (task.station) {
      const area = STATION_HIT_AREAS[task.station];
      x = area.x + area.width / 2; y = area.y + area.height / 2; width = Math.min(area.width, 220); height = Math.min(area.height, 150);
    } else return;
    this.targetRing.setPosition(x, y).setDisplaySize(width, height).setVisible(true).setAlpha(this.reducedMotion ? 0.8 : 1);
    this.targetHandBaseY = y - height * 0.55;
    this.targetHand.setPosition(x + width * 0.25, this.targetHandBaseY).setVisible(true);
  }

  private wait(duration: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(duration, () => resolve()));
  }

  update(): void {
    if (this.held && this.chef) {
      this.held.setPosition(this.chef.view.x + 55, this.chef.view.y - 95).setDepth(this.chef.view.depth + 2);
    }
    if (!this.reducedMotion && this.targetRing?.visible) this.targetRing.setAlpha(0.65 + Math.sin(this.time.now / 250) * 0.25);
    if (!this.reducedMotion && this.targetHand?.visible) this.targetHand.y = this.targetHandBaseY + Math.sin(this.time.now / 240) * 10;
  }
}
