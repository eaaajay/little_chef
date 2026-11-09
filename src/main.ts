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
  start: () => {
    try { audio.unlock(); } finally { restaurant.startService(); }
  },
  takeOrder: () => restaurant.takeOrder(),
  confirmOrder: () => restaurant.confirmOrder(),
  replayOrder: () => restaurant.replayOrder(),
  closeFridge: () => restaurant.closeFridge(),
  selectIngredient: (id) => restaurant.selectIngredient(id),
  activateStation: (station) => restaurant.activateStation(station),
  serveTable: (tableIndex) => { void restaurant.serveTable(tableIndex); },
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
document.addEventListener('visibilitychange', () => {
  const hidden = document.hidden;
  audio.pauseForVisibility(hidden);
  if (hidden) {
    if (restaurant.scene.isActive()) restaurant.scene.pause();
  } else if (restaurant.scene.isPaused()) {
    restaurant.scene.resume();
  }
});
