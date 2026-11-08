import Phaser from 'phaser';
import './style.css';
import { AudioManager } from './audio';
import { RestaurantScene } from './restaurantScene';
import { RestaurantStore } from './store';
import { GameUI } from './ui';

const store = new RestaurantStore();
store.settlePending();
const audio = new AudioManager(store.snapshot().soundOn);
let restaurant: RestaurantScene;

const ui = new GameUI(store, audio, {
  start: () => { audio.unlock(); restaurant.startService(); },
  confirmOrder: () => restaurant.confirmOrder(),
  replayOrder: () => restaurant.replayOrder(),
  closeFridge: () => restaurant.closeFridge(),
  selectIngredient: (id) => restaurant.selectIngredient(id),
  setSound: (enabled) => { audio.setEnabled(enabled); store.setSound(enabled); ui.setSound(enabled); },
  reset: () => { store.reset(); window.location.reload(); },
});

restaurant = new RestaurantScene(ui, audio, store);
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-canvas',
  width: 1200,
  height: 900,
  transparent: true,
  disableContextMenu: true,
  render: { antialias: true, powerPreference: 'high-performance' },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { noAudio: true },
  scene: [restaurant],
};

new Phaser.Game(config);
document.addEventListener('visibilitychange', () => audio.pauseForVisibility(document.hidden));
