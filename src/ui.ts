import { AudioManager } from './audio';
import { ALL_WORDS, INGREDIENTS, WORD_META, type IngredientId, type Recipe, type Resident, type StationId, type WordId } from './data';
import type { OrderProgress, TaskDescriptor } from './logic';
import type { RestaurantStore } from './store';

export interface OrderView { recipe: Recipe; resident: Resident; orderNumber: number }
export interface UICallbacks {
  start: () => void;
  takeOrder: () => void;
  confirmOrder: () => void;
  replayOrder: () => void;
  closeFridge: () => void;
  selectIngredient: (id: IngredientId) => void;
  activateStation: (station: StationId) => void;
  serveTable: (tableIndex: number) => void;
  setSound: (enabled: boolean) => void;
  reset: () => void;
}
export interface GameControlState {
  canTakeOrder: boolean;
  station?: StationId;
  table?: number;
  busy: boolean;
}

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const MODAL_IDS = ['order-modal', 'fridge-modal', 'wordbook-modal', 'reset-modal'];
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class GameUI {
  private toastTimer?: number;
  private actionToken = 0;
  private currentOrder?: OrderView;
  private suppressClickUntil = 0;
  private returnFocus?: HTMLElement;
  private pendingReturnFocus?: HTMLElement;

  constructor(private readonly store: RestaurantStore, private readonly audio: AudioManager, private readonly callbacks: UICallbacks) {
    this.onIngredientSelected = callbacks.selectIngredient;
    byId<HTMLButtonElement>('start-button').addEventListener('click', callbacks.start);
    byId('order-confirm').addEventListener('click', callbacks.confirmOrder);
    byId('order-replay').addEventListener('click', callbacks.replayOrder);
    byId('ticket-replay').addEventListener('click', callbacks.replayOrder);
    byId('fridge-close').addEventListener('click', callbacks.closeFridge);
    byId('wordbook-button').addEventListener('click', () => {
      this.pendingReturnFocus = byId('wordbook-button');
      this.showWordbook();
    });
    byId('wordbook-close').addEventListener('click', () => this.closeModal('wordbook-modal'));
    byId('sound-button').addEventListener('click', () => callbacks.setSound(!this.audio.enabled));
    byId('reset-button').addEventListener('click', () => {
      this.pendingReturnFocus = byId('reset-button');
      this.openModal('reset-modal', '#reset-cancel');
    });
    byId('reset-cancel').addEventListener('click', () => this.closeModal('reset-modal'));
    byId('reset-confirm').addEventListener('click', callbacks.reset);
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach((button) => {
      button.addEventListener('click', () => {
        const control = button.dataset.control;
        this.pendingReturnFocus = control === 'guest' || control === 'fridge' ? button : undefined;
        if (control === 'guest') callbacks.takeOrder();
        else if (control) callbacks.activateStation(control as StationId);
      });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-table]').forEach((button) => {
      button.addEventListener('click', () => callbacks.serveTable(Number(button.dataset.table)));
    });
    document.addEventListener('keydown', (event) => this.handleModalKeydown(event));
    this.updateStore();
    this.setSound(this.audio.enabled);
  }

  loading(progress: number): void { byId('loading-progress').style.width = `${Math.round(progress * 100)}%`; }

  ready(): void {
    byId('loading-screen').classList.add('is-hidden');
    byId('welcome-screen').classList.remove('is-hidden');
    byId<HTMLButtonElement>('start-button').disabled = false;
    byId<HTMLButtonElement>('start-button').focus();
  }

  start(): void {
    byId('welcome-screen').classList.add('is-hidden');
    byId('hud').classList.remove('is-hidden');
    this.toast('第一位客人马上就到，准备接单吧！');
  }

  updateStore(): void {
    const state = this.store.snapshot();
    byId('coin-count').textContent = String(state.coins);
    byId('word-count').textContent = `${state.words.length}/${ALL_WORDS.length}`;
  }

  setSound(enabled: boolean): void {
    const button = byId<HTMLButtonElement>('sound-button');
    button.textContent = enabled ? '🔊' : '🔇';
    button.setAttribute('aria-label', enabled ? '关闭声音' : '打开声音');
  }

  private visibleModal(): HTMLElement | undefined {
    return MODAL_IDS.map((id) => byId(id)).find((modal) => !modal.classList.contains('is-hidden'));
  }

  private focusableElements(modal: HTMLElement): HTMLElement[] {
    return [...modal.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.getClientRects().length > 0);
  }

  private setBackgroundInert(inert: boolean): void {
    byId('hud').inert = inert;
    byId('game-canvas').inert = inert;
  }

  private openModal(id: string, focusSelector?: string): void {
    if (!this.modalOpen) {
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      this.returnFocus = this.pendingReturnFocus ?? activeElement;
      this.pendingReturnFocus = undefined;
    }
    const modal = byId(id);
    modal.classList.remove('is-hidden');
    this.setBackgroundInert(true);
    requestAnimationFrame(() => {
      if (modal.classList.contains('is-hidden')) return;
      const target = (focusSelector ? modal.querySelector<HTMLElement>(focusSelector) : null) ?? this.focusableElements(modal)[0];
      target?.focus();
    });
  }

  private closeModal(id: string): void {
    byId(id).classList.add('is-hidden');
    if (this.modalOpen) return;
    this.setBackgroundInert(false);
    const target = this.returnFocus;
    this.returnFocus = undefined;
    requestAnimationFrame(() => {
      const usableTarget = target?.isConnected && target !== document.body && !(target instanceof HTMLButtonElement && target.disabled);
      if (usableTarget) target.focus();
      else if (target?.closest('#keyboard-controls')) document.querySelector<HTMLElement>('#keyboard-controls button:not([disabled])')?.focus();
    });
  }

  private handleModalKeydown(event: KeyboardEvent): void {
    const modal = this.visibleModal();
    if (!modal) return;
    if (event.key === 'Escape') {
      if (modal.id === 'fridge-modal') this.callbacks.closeFridge();
      else if (modal.id === 'wordbook-modal' || modal.id === 'reset-modal') this.closeModal(modal.id);
      else return;
      event.preventDefault();
      return;
    }
    if (event.key !== 'Tab') return;
    const elements = this.focusableElements(modal);
    if (elements.length === 0) { event.preventDefault(); return; }
    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !modal.contains(active))) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && (active === last || !modal.contains(active))) {
      first.focus();
      event.preventDefault();
    }
  }

  showOrder(order: OrderView): void {
    this.currentOrder = order;
    byId('order-customer').textContent = `${order.resident.chinese} · ${order.resident.name} 来啦`;
    byId('order-sentence').textContent = `“I want ${order.recipe.english.toLowerCase()}, please.”`;
    byId<HTMLImageElement>('order-dish-image').src = order.recipe.dishImage;
    byId('order-dish-name').textContent = order.recipe.english;
    byId('order-dish-chinese').textContent = order.recipe.chinese;
    byId('order-ingredients').innerHTML = order.recipe.ingredients.map(({ id, count }) => `<span>${INGREDIENTS[id].english}${count > 1 ? ` ×${count}` : ''}</span>`).join('');
    this.openModal('order-modal', '#order-confirm');
  }

  hideOrder(): void { this.closeModal('order-modal'); }

  showTicket(order: OrderView, progress: OrderProgress): void {
    this.currentOrder = order;
    byId('order-number').textContent = `#${String(order.orderNumber).padStart(3, '0')}`;
    byId<HTMLImageElement>('ticket-dish-image').src = order.recipe.dishImage;
    byId('ticket-dish-name').textContent = order.recipe.english;
    byId('ticket-dish-chinese').textContent = order.recipe.chinese;
    byId('ticket-ingredients').innerHTML = order.recipe.ingredients.map(({ id, count }) => `<span>${INGREDIENTS[id].chinese}${count > 1 ? `×${count}` : ''}</span>`).join('');
    byId('order-ticket').classList.remove('is-hidden');
    this.updateProgress(progress);
  }

  updateProgress(progress: OrderProgress): void {
    // Cooking needs the scene, not a tall order card. The full order is shown before acceptance.
    byId('order-ticket').classList.add('compact');
    const labels = progress.recipe.steps.map((step) => {
      if (step.ingredientId) {
        const ingredient = INGREDIENTS[step.ingredientId];
        const count = progress.recipe.ingredients.find((item) => item.id === step.ingredientId)?.count ?? 1;
        return `${ingredient.english}${count > 1 ? ` ×${count}` : ''}`;
      }
      return `${step.verbCn} · ${step.verb}`;
    });
    labels.push('上菜 · serve');
    const currentIndex = progress.dishReady ? labels.length - 1 : progress.stepIndex;
    byId('ticket-steps').innerHTML = labels.map((label, index) => {
      const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : '';
      return `<li class="${state}">${label}</li>`;
    }).join('');
    this.task(progress.task());
  }

  hideTicket(): void { byId('order-ticket').classList.add('is-hidden'); }

  task(task: TaskDescriptor): void {
    byId('task-number').textContent = String(task.stepNumber);
    byId('task-text').textContent = task.text;
    byId('task-english').textContent = task.english;
    byId('task-progress-bar').style.width = `${Math.round(task.progress * 100)}%`;
  }

  waitingForGuest(): void {
    this.task({ text: '等待下一位客人', english: 'A new friend is on the way!', stepNumber: 1, progress: 0 });
  }

  updateGameControls(state: GameControlState): void {
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach((button) => {
      const control = button.dataset.control;
      button.disabled = state.busy || (control === 'guest' ? !state.canTakeOrder : control !== state.station);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-table]').forEach((button) => {
      button.disabled = state.busy || Number(button.dataset.table) !== state.table;
    });
  }

  showFridge(recipe: Recipe, progress: OrderProgress): void {
    this.renderFridgeItems(recipe, progress);
    this.openModal('fridge-modal', '.fridge-item.target');
  }

  updateFridge(recipe: Recipe, progress: OrderProgress): void { this.renderFridgeItems(recipe, progress); }

  setFridgeBusy(busy: boolean): void {
    byId('fridge-items').setAttribute('aria-busy', String(busy));
    document.querySelectorAll<HTMLButtonElement>('.fridge-item').forEach((button) => {
      button.disabled = busy || button.classList.contains('collected');
    });
  }

  closeFridge(): void { this.closeModal('fridge-modal'); }
  get fridgeOpen(): boolean { return !byId('fridge-modal').classList.contains('is-hidden'); }
  get modalOpen(): boolean { return this.visibleModal() !== undefined; }

  private renderFridgeItems(recipe: Recipe, progress: OrderProgress): void {
    const container = byId('fridge-items');
    container.innerHTML = '';
    container.setAttribute('aria-busy', 'false');
    const expected = progress.currentStep?.ingredientId;
    for (const { id, count } of recipe.ingredients) {
      const ingredient = INGREDIENTS[id];
      const collected = progress.collected.some((item) => item.id === id);
      const button = document.createElement('button');
      button.className = `fridge-item${id === expected ? ' target' : ''}${collected ? ' collected' : ''}`;
      button.dataset.ingredient = id;
      button.dataset.testid = `ingredient-${id}`;
      button.disabled = collected;
      button.setAttribute('aria-label', `${ingredient.english} ${ingredient.chinese}${count > 1 ? `，${count} 份` : ''}${collected ? '，已取' : ''}`);
      button.innerHTML = `${collected ? '<span class="ingredient-check">✓</span>' : ''}${count > 1 ? `<span class="ingredient-count">×${count}</span>` : ''}<img src="${ingredient.image}" alt="" /><strong>${ingredient.english}</strong><small>${ingredient.chinese}</small>`;
      button.addEventListener('click', () => {
        if (Date.now() < this.suppressClickUntil || collected) return;
        this.selectIngredientFromUI(id);
      });
      this.attachDrag(button, id);
      container.appendChild(button);
    }
    byId('fridge-tip-text').textContent = expected ? `现在请找 ${INGREDIENTS[expected].english} · ${INGREDIENTS[expected].chinese}` : '食材取齐啦，去做菜吧！';
    if (this.fridgeOpen) {
      requestAnimationFrame(() => {
        const target = container.querySelector<HTMLButtonElement>('.fridge-item.target:not([disabled])') ?? byId<HTMLButtonElement>('fridge-close');
        target.focus();
      });
    }
  }

  private selectIngredientFromUI(id: IngredientId): void {
    // Re-dispatch through the public callback registered on the scene by main.ts.
    this.onIngredientSelected?.(id);
  }
  onIngredientSelected?: (id: IngredientId) => void;

  wrongIngredient(id: IngredientId): void {
    const button = document.querySelector(`[data-ingredient="${id}"]`);
    button?.classList.remove('wrong');
    requestAnimationFrame(() => button?.classList.add('wrong'));
  }

  private attachDrag(button: HTMLButtonElement, id: IngredientId): void {
    let start = { x: 0, y: 0 };
    let dragging = false;
    let pointerId = -1;
    const ghost = byId('drag-ghost');
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (!dragging && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) {
        dragging = true;
        button.setPointerCapture(event.pointerId);
        ghost.querySelector('img')!.src = INGREDIENTS[id].image;
        ghost.classList.remove('is-hidden');
      }
      if (dragging) {
        event.preventDefault();
        ghost.style.left = `${event.clientX}px`;
        ghost.style.top = `${event.clientY}px`;
      }
    };
    const end = (event: PointerEvent, commit = true) => {
      if (event.pointerId !== pointerId) return;
      if (dragging && commit) {
        const dialog = document.querySelector('.fridge-dialog')!.getBoundingClientRect();
        const inside = event.clientX >= dialog.left && event.clientX <= dialog.right && event.clientY >= dialog.top && event.clientY <= dialog.bottom;
        if (!inside) this.selectIngredientFromUI(id);
        this.suppressClickUntil = Date.now() + 350;
      }
      dragging = false;
      pointerId = -1;
      ghost.classList.add('is-hidden');
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerup', end);
      button.removeEventListener('pointercancel', cancel);
    };
    const cancel = (event: PointerEvent) => end(event, false);
    button.addEventListener('pointerdown', (event) => {
      if (button.disabled || event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY };
      pointerId = event.pointerId;
      button.addEventListener('pointermove', move);
      button.addEventListener('pointerup', end);
      button.addEventListener('pointercancel', cancel);
    });
  }

  showWordbook(): void {
    const learned = new Set(this.store.snapshot().words);
    byId('wordbook-summary').textContent = `已经点亮 ${learned.size} / ${ALL_WORDS.length} 个单词 · 每完成一道菜，都会认识更多朋友`;
    const grid = byId('word-grid');
    grid.innerHTML = '';
    for (const word of ALL_WORDS) {
      const meta = WORD_META[word];
      const unlocked = learned.has(word);
      const button = document.createElement('button');
      button.className = 'word-card';
      button.disabled = !unlocked;
      button.dataset.word = word;
      const visual = word in INGREDIENTS ? `<img src="${INGREDIENTS[word as IngredientId].image}" alt="" />` : `<span class="word-action">${meta.english}</span>`;
      button.innerHTML = `${visual}<strong>${meta.english}</strong><small>${meta.chinese}</small>${unlocked ? '<span class="word-play">▶</span>' : ''}`;
      button.setAttribute('aria-label', `${meta.english} ${meta.chinese}${unlocked ? '，播放发音' : '，尚未收集'}`);
      if (unlocked) button.addEventListener('click', () => this.audio.word(word as WordId));
      grid.appendChild(button);
    }
    this.openModal('wordbook-modal', '#wordbook-close');
  }

  toast(message: string, duration = 2300): void {
    window.clearTimeout(this.toastTimer);
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), duration);
  }

  action(label: string, duration: number): void {
    const token = ++this.actionToken;
    const panel = byId('action-progress');
    const bar = byId('action-progress-bar');
    byId('action-label').textContent = label;
    panel.classList.remove('is-hidden');
    bar.style.transition = 'none';
    bar.style.width = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== this.actionToken) return;
      bar.style.transition = `width ${duration}ms linear`;
      bar.style.width = '100%';
    }));
    window.setTimeout(() => { if (token === this.actionToken) panel.classList.add('is-hidden'); }, duration + 80);
  }

  celebrate(amount: number): void {
    const pill = byId('coin-pill');
    pill.classList.remove('coin-pop');
    requestAnimationFrame(() => pill.classList.add('coin-pop'));
    this.updateStore();
    this.toast(`太棒了！客人满意付款，金币 +${amount}`, 3200);
  }

  get replayOrder(): (() => void) | undefined { return this.onReplayOrder; }
  onReplayOrder?: () => void;
  get visibleOrder(): OrderView | undefined { return this.currentOrder; }
}
