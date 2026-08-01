import './styles.css';
import { AppController } from './app/AppController';

const root = document.querySelector<HTMLElement>('#app');
const phaserLayer = document.querySelector<HTMLElement>('#phaser-layer');

if (!root || !phaserLayer) {
  throw new Error('ONE QUICK EMAIL could not find its application roots');
}

const controller = new AppController(root, phaserLayer);
controller.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => controller.destroy());
}
